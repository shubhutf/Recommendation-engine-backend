const express = require("express");

// Router create kar rahe hain.
const router = express.Router();

// Recommendation controller import kar rahe hain.
const {
  getRecommendations,
} = require("../controllers/recommendation.controller");

/**
 * ======================================================
 * RECOMMENDATION ROUTES
 * ------------------------------------------------------
 * Yahan recommendation related saare endpoints define honge.
 * ======================================================
 */

/**
 * ------------------------------------------------------
 * Selected product ke liye similar products recommend karega.
 *
 * GET /api/v1/recommendations/:productId
 *
 * Optional Query Parameter:
 * ?limit=5
 * ------------------------------------------------------
 */
router.get("/:productId", getRecommendations);

// Router export kar rahe hain.
module.exports = router;