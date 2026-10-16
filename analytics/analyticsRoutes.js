const express = require("express");
const mongoose = require("mongoose");
const { buildAnalyticsSummary } = require("./analyticsService");

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({
        message: "Database connection is not ready.",
      });
    }

    const [recommendationDocs, productDocs, interactions] = await Promise.all([
      db.collection("recommendations").find({ source: "real" }).toArray(),
      db.collection("products").find({}).toArray(),
      db.collection("events").aggregate([
        { $match: { source: "real", eventType: { $in: ["IMPRESSION", "CLICK", "CART", "PURCHASE", "FEEDBACK", "VIEW"] } } },
        { $group: { _id: { engine: "$engine", position: "$position", eventType: "$eventType" }, count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const summary = buildAnalyticsSummary(recommendationDocs, productDocs, 5);
    const totals = {};
    const groups = new Map();
    for (const row of interactions) {
      totals[row._id.eventType] = (totals[row._id.eventType] || 0) + row.count;
      if (!row._id.engine || !row._id.position) continue;
      const key = `${row._id.engine}:${row._id.position}`;
      if (!groups.has(key)) groups.set(key, { engine: row._id.engine, position: row._id.position, impressions: 0, clicks: 0 });
      if (row._id.eventType === "IMPRESSION") groups.get(key).impressions += row.count;
      if (row._id.eventType === "CLICK") groups.get(key).clicks += row.count;
    }
    summary.interactions = { source: "real", totals, byPositionAndEngine: [...groups.values()].sort((a, b) => a.engine.localeCompare(b.engine) || a.position - b.position)
      .map(row => ({ ...row, ctr: row.impressions ? row.clicks / row.impressions : null })) };
    summary.logging = require("../src/services/event.service").queueStats();

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
