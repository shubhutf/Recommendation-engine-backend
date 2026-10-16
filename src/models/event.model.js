const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  eventType: { type: String, enum: ["IMPRESSION", "VIEW", "CLICK", "CART", "PURCHASE", "FEEDBACK"], required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sourceProductId: mongoose.Schema.Types.ObjectId,
  recommendedProductId: mongoose.Schema.Types.ObjectId,
  requestId: String,
  impressionId: { type: String },
  position: Number,
  engine: { type: String, enum: ["rules", "ml"] },
  modelVersion: String,
  modelScore: Number,
  feedback: { type: String, enum: ["helpful", "not-helpful"] },
  productSnapshot: mongoose.Schema.Types.Mixed,
  sourceSnapshot: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now, required: true },
  source: { type: String, enum: ["real", "simulated"], required: true },
}, { collection: "events" });
schema.index({ userId: 1, source: 1, timestamp: -1 });
schema.index({ source: 1, eventType: 1, timestamp: -1, productId: 1 });
// One outcome of each kind per exposure. Feedback can be changed using an upsert.
schema.index({ impressionId: 1, eventType: 1 }, { unique: true, partialFilterExpression: { impressionId: { $type: "string" } } });
module.exports = mongoose.model("Event", schema);
