const Event = require("../models/event.model");
const { snapshot } = require("./event.service");
const DAY = 86400000;

async function scoreCandidates(source, candidates, user, asOf) {
  if (!user) return { reason: "anonymous" };
  const history = await Event.find({ userId: user._id, source: "real", eventType: { $in: ["CLICK", "CART", "PURCHASE"] }, timestamp: { $lt: asOf } })
    .sort({ timestamp: -1 }).limit(1000).select("eventType timestamp productSnapshot").lean();
  const minimum = Math.max(1, Number(process.env.ML_MIN_HISTORY) || 5);
  const distinct = new Set(history.filter(e => e.productSnapshot).map(e => String(e.productSnapshot._id)));
  if (distinct.size < minimum) return { reason: "cold_start" };
  if (!process.env.ML_SERVICE_URL) return { reason: "ml_unconfigured" };
  if (!candidates.length) return { reason: "no_in_stock_candidates" };
  const ids = candidates.map(p => p._id);
  const stats = await Event.aggregate([
    { $match: { source: "real", eventType: { $in: ["CLICK", "CART", "PURCHASE"] }, productId: { $in: ids }, timestamp: { $gte: new Date(asOf - 14 * DAY), $lt: asOf } } },
    { $addFields: { weight: { $switch: { branches: [{ case: { $eq: ["$eventType", "PURCHASE"] }, then: 3 }, { case: { $eq: ["$eventType", "CART"] }, then: 2 }], default: 1 } } } },
    { $group: { _id: "$productId", recent: { $sum: { $cond: [{ $gte: ["$timestamp", new Date(asOf - 7 * DAY)] }, "$weight", 0] } }, previous: { $sum: { $cond: [{ $lt: ["$timestamp", new Date(asOf - 7 * DAY)] }, "$weight", 0] } } } },
  ]);
  const timeout = Math.min(5000, Math.max(100, Number(process.env.ML_TIMEOUT_MS) || 1500));
  try {
    const response = await fetch(`${process.env.ML_SERVICE_URL.replace(/\/$/, "")}/score`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-ML-Token": process.env.ML_SERVICE_TOKEN || "" },
      signal: AbortSignal.timeout(timeout),
      body: JSON.stringify({ source: snapshot(source), candidates: candidates.map(p => snapshot(p)),
        history: history.reverse(), globalStats: Object.fromEntries(stats.map(s => [String(s._id), { recent: s.recent, previous: s.previous }])), asOf: asOf.toISOString() }),
    });
    if (!response.ok) throw new Error("ML service error");
    const result = await response.json();
    const allowed = new Set(ids.map(String));
    if (typeof result.modelVersion !== "string" || !/^v[\w.-]{1,63}$/.test(result.modelVersion) || !["real", "simulated"].includes(result.trainingSource)
      || !Array.isArray(result.scores) || result.scores.length !== candidates.length
      || new Set(result.scores.map(s => s.productId)).size !== candidates.length
      || result.scores.some(s => !allowed.has(s.productId) || !Number.isFinite(s.score))) throw new Error("Invalid ML response");
    return result;
  } catch (error) {
    return { reason: error.name === "TimeoutError" || error.name === "AbortError" ? "ml_timeout" : "ml_unavailable" };
  }
}
module.exports = { scoreCandidates };
