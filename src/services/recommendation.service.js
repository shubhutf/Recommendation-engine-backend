const Product = require("../models/product.model");

/**
 * ======================================================
 * RECOMMENDATION SERVICE
 * ------------------------------------------------------
 * Is service me recommendation engine ki saari
 * business logic rahegi.
 * ======================================================
 */

class RecommendationService {

  /**
   * ======================================================
   * SMART PRODUCT RECOMMENDATION
   * ------------------------------------------------------
   * User ke selected product ke basis par similar
   * substitute products return karega.
   *
   * Logic:
   * 1. Product find karo
   * 2. Same category
   * 3. Same size
   * 4. Different brand
   * 5. Nearby price
   * 6. Highest rating
   * ======================================================
   */
 async getRecommendations(productId, limit = 5) {

    // Product ID mandatory hai.
    if (!productId) {
      throw new Error("Product ID is required.");
    }

    /**
     * Selected product database se fetch kar rahe hain.
     */
    const selectedProduct = await Product.findById(productId);

    if (!selectedProduct) {
      throw new Error("Selected product not found.");
    }

    /**
     * Selected product ki price ka
     * ±20% range calculate kar rahe hain.
     */
    const minimumPrice = selectedProduct.price * 0.8;

    const maximumPrice = selectedProduct.price * 1.2;

    /**
     * Similar substitute products fetch kar rahe hain.
     */
    const recommendations = await Product.find({

      /**
       * Same category hona chahiye.
       */
      category: selectedProduct.category,

      /**
       * Same pack size hona chahiye.
       */
      size: selectedProduct.size,

      /**
       * Selected product khud recommendation me
       * nahi aana chahiye.
       */
      _id: {
        $ne: selectedProduct._id,
      },

      /**
       * Same brand recommend nahi karenge.
       */
      brand: {
        $ne: selectedProduct.brand,
      },

      /**
       * Nearby price products hi recommend honge.
       */
      price: {
        $gte: minimumPrice,
        $lte: maximumPrice,
      },
    })

      /**
       * Highest rated products pehle.
       */
      .sort({
        rating: -1,
      })

      /**
       * Sirf required recommendations return hongi.
       */
      .limit(Number(limit))

      /**
       * Plain JavaScript object return karega.
       */
      .lean();

    return recommendations;
  }
}

/**
 * Single instance export kar rahe hain.
 */
module.exports = new RecommendationService();