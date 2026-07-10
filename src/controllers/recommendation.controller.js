const recommendationService = require("../services/recommendation.service");
const ApiResponse = require("../utils/ApiResponse");

/**
 * ======================================================
 * RECOMMENDATION CONTROLLER
 * ------------------------------------------------------
 * Yahan sirf request aur response handle hoga.
 * Recommendation ki business logic service layer me hai.
 * ======================================================
 */

/**
 * ------------------------------------------------------
 * SMART PRODUCT RECOMMENDATION
 *
 * Selected product ke liye substitute products
 * return karega.
 *
 * Endpoint:
 * GET /api/v1/recommendations/:productId
 * ------------------------------------------------------
 */
const getRecommendations = async (req, res, next) => {
  try {

    // URL se product id le rahe hain.
    const { productId } = req.params;

    // Query parameter se limit read kar rahe hain.
    // Default 5 recommendations return hongi.
    const { limit = 5 } = req.query;

    // Recommendation service call kar rahe hain.
    const recommendations =
      await recommendationService.getRecommendations(
        productId,
        limit
      );

    // Success response bhej rahe hain.
    res.status(200).json(
      new ApiResponse(
        200,
        "Recommendations fetched successfully.",
        recommendations
      )
    );

  } catch (error) {

    // Error global error handler ko bhej rahe hain.
    next(error);

  }
};

/**
 * Controller functions export kar rahe hain.
 */
module.exports = {
  getRecommendations,
};