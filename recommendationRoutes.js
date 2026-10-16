const express = require("express");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const { getRecommendations, calculateRecommendationScore } = require("./recommendationService");
const { buildRecommendationExplanation } = require("./aiExplanationService");
const { scoreCandidates } = require("./src/services/ml.service");
const { snapshot, logImpressions } = require("./src/services/event.service");
const router = express.Router();

router.get("/:productId", async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    if (!mongoose.isObjectIdOrHexString(req.params.productId)) return res.status(400).json({ message: "Invalid productId" });
    const sourceProduct = await db.collection("products").findOne({ _id: new mongoose.Types.ObjectId(req.params.productId) });
    if (!sourceProduct) return res.status(404).json({ message: "Product not found" });
    // Indexed category query; inventory only for this bounded candidate set.
    const candidates = await db.collection("products").find({ category: sourceProduct.category, _id: { $ne: sourceProduct._id } }).sort({ _id: 1 }).limit(200).toArray();
    const stock = await db.collection("inventory").find({ productId: { $in: candidates.map(p => p._id) } }).toArray();
    const inventoryMap = Object.fromEntries(stock.map(row => [String(row.productId), row]));
    for (const candidate of candidates) candidate.availableQuantity = inventoryMap[String(candidate._id)]?.availableQuantity || 0;
    const asOf = new Date();
    let ml;
    try { ml = await scoreCandidates(sourceProduct, candidates.filter(p => p.availableQuantity > 0), req.user, asOf); }
    catch { ml = { reason: "feature_store_unavailable" }; }
    const engine = ml.scores ? "ml" : "rules";
    const modelVersion = ml.modelVersion || "rules-v1";
    let recommendations;
    if (engine === "ml") {
      recommendations = ml.scores.sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId)).slice(0, 3).map(row => {
        const candidate = candidates.find(p => String(p._id) === row.productId);
        return { productId: row.productId, score: row.score, modelScore: row.score, breakdown: calculateRecommendationScore(sourceProduct, candidate, inventoryMap).breakdown };
      });
    } else {
      recommendations = getRecommendations(sourceProduct._id, [sourceProduct, ...candidates], inventoryMap, 3).map(row => ({ ...row, modelScore: null }));
    }
    const requestId = randomUUID();
    const explained = await Promise.all(recommendations.map(async (row, index) => {
      const product = candidates.find(p => String(p._id) === String(row.productId));
      return { ...row, product, engine, modelVersion, trainingSource: ml.trainingSource || null, fallbackReason: ml.reason || null,
        position: index + 1, impressionId: randomUUID(), explanation: await buildRecommendationExplanation(sourceProduct, product, row.breakdown) };
    }));
    const timestamp = asOf;
    if (explained.length) logImpressions(db, explained.map(row => ({
      userId: req.user?._id || null, eventType: "IMPRESSION", productId: row.productId,
      sourceProductId: sourceProduct._id, recommendedProductId: row.productId, requestId, impressionId: row.impressionId,
      position: row.position, engine, modelVersion, modelScore: row.score, timestamp, source: "real",
      productSnapshot: snapshot(row.product), sourceSnapshot: snapshot(sourceProduct),
    })), explained.map(row => ({ sourceProductId: sourceProduct._id, recommendedProductId: new mongoose.Types.ObjectId(String(row.productId)),
      recommendationScore: row.score, reason: row.explanation, engine, modelVersion, createdAt: timestamp, source: "real" })));
    return res.json({ sourceProductId: String(sourceProduct._id), requestId, engine, modelVersion, fallbackReason: ml.reason || null, recommendations: explained });
  } catch (error) { return next(error); }
});
module.exports = router;
