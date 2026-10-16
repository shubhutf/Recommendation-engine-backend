const Event = require("../models/event.model");

// Bounded best-effort writes. A process crash can lose queued impressions; use a durable
// queue before claiming exactly-once delivery. Outcome HTTP writes are acknowledged by Mongo.
let pending = 0;
const active = new Set();
let dropped = 0;
function enqueue(task) {
  if (pending >= 100) { dropped++; console.warn("Impression queue full; batch dropped"); return false; }
  pending++;
  const work = new Promise(resolve => setImmediate(resolve)).then(task)
    .catch(() => { console.warn("Impression logging failed; batch dropped"); dropped++; })
    .finally(() => { pending--; active.delete(work); });
  active.add(work);
  return true;
}
async function drain() { await Promise.allSettled([...active]); }
function queueStats() { return { pending, dropped }; }
function snapshot(product, quantity = product.availableQuantity ?? 0) {
  return { _id: String(product._id), productName: product.productName, category: product.category,
    brand: product.brand, description: product.description || "", price: product.price, rating: product.rating,
    createdAt: product.createdAt, availableQuantity: quantity };
}
function logImpressions(db, impressions, legacy) {
  return enqueue(() => Promise.all([
    Event.insertMany(impressions, { ordered: false }),
    db.collection("recommendations").insertMany(legacy, { ordered: false }),
  ]));
}
module.exports = { enqueue, drain, queueStats, snapshot, logImpressions };
