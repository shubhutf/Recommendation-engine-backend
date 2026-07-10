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

    const [recommendationDocs, productDocs] = await Promise.all([
      db.collection("recommendations").find({}).toArray(),
      db.collection("products").find({}).toArray(),
    ]);

    const summary = buildAnalyticsSummary(recommendationDocs, productDocs, 5);

    return res.json(summary);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
