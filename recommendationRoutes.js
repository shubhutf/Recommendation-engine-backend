// Express routes for recommendation lookups.
// This route reads products and inventory from MongoDB, then uses the scoring service to return the top matches.
const express = require("express");
const mongoose = require("mongoose");
const { getRecommendations } = require("./recommendationService");
const { buildRecommendationExplanation } = require("./aiExplanationService");

const router = express.Router();

router.get("/:productId", async (req, res) => {
  try {
    // The main app must connect mongoose before this route runs.
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({
        message: "Database connection is not ready.",
      });
    }

    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        message: "Invalid productId.",
      });
    }

    // Load the source product and all candidate products from MongoDB.
    const [sourceProduct, allProducts, inventoryDocs] = await Promise.all([
      db.collection("products").findOne({ _id: new mongoose.Types.ObjectId(productId) }),
      db.collection("products").find({}).toArray(),
      db.collection("inventory").find({}).toArray(),
    ]);

    if (!sourceProduct) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    // Convert inventory rows into a lookup map by product id.
    const inventoryMap = inventoryDocs.reduce((map, item) => {
      map[String(item.productId)] = item;
      return map;
    }, {});

    // Run the recommendation engine and return the top 3 matches.
    const recommendations = getRecommendations(
      sourceProduct._id,
      allProducts,
      inventoryMap,
      3
    );

    const explainedRecommendations = await Promise.all(recommendations.map(async (recommendation) => {
      const recommendedProduct = allProducts.find(
        (product) => String(product._id) === String(recommendation.productId)
      );

      return {
        ...recommendation,
        explanation: await buildRecommendationExplanation(
          sourceProduct,
          recommendedProduct,
          recommendation.breakdown
        ),
      };
    }));

    return res.json({
      sourceProductId: String(sourceProduct._id),
      recommendations: explainedRecommendations,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
