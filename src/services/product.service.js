const Product = require("../models/product.model");

/**
 * --------------------------------------------------
 * PRODUCT SERVICE
 * Yahan saari business logic handle hogi.
 * Controller sirf request aur response manage karega.
 * --------------------------------------------------
 */
class ProductService {
  /**
   * Naya product create karega.
   * @param {Object} productData
   * @returns {Promise<Object>}
   */
  async createProduct(productData) {
    try {
      // Product document create karke database me save kar rahe hain.
      const product = await Product.create(productData);

      return product;
    } catch (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  /**
   * Saare products fetch karega.
   * Optional filtering, sorting aur pagination support karta hai.
   *
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async getAllProducts(query = {}) {
    try {
      const {
        category,
        brand,
        minPrice,
        maxPrice,
        sortBy,
        page = 1,
        limit = 10,
      } = query;

      // -----------------------------
      // Dynamic Filters
      // Query parameters ke according filter object bana rahe hain.
      // -----------------------------
      const filter = {};

      if (category) {
        filter.category = category;
      }

      if (brand) {
        filter.brand = brand;
      }

      if (minPrice || maxPrice) {
        filter.price = {};

        if (minPrice) {
          filter.price.$gte = Number(minPrice);
        }

        if (maxPrice) {
          filter.price.$lte = Number(maxPrice);
        }
      }

      // -----------------------------
      // Sorting Logic
      // Default latest products pehle dikhayenge.
      // -----------------------------
      let sortOption = { createdAt: -1 };

      switch (sortBy) {
        case "price_asc":
          sortOption = { price: 1 };
          break;

        case "price_desc":
          sortOption = { price: -1 };
          break;

        case "rating_desc":
          sortOption = { rating: -1 };
          break;

        default:
          sortOption = { createdAt: -1 };
      }

      // Pagination calculate kar rahe hain.
      const pageNumber = Number(page);
      const pageLimit = Number(limit);
      const skip = (pageNumber - 1) * pageLimit;

      // Products aur total count parallel me fetch kar rahe hain.
      const [products, totalProducts] = await Promise.all([
        Product.find(filter)
          .sort(sortOption)
          .skip(skip)
          .limit(pageLimit)
          .lean(),

        Product.countDocuments(filter),
      ]);

      return {
        products,

        pagination: {
          totalProducts,
          currentPage: pageNumber,
          totalPages: Math.ceil(totalProducts / pageLimit),
          limit: pageLimit,
        },
      };
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  /**
   * Existing product update karega.
   *
   * @param {String} productId
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async updateProduct(productId, updateData) {
    try {
      // Product ID mandatory hai.
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      // Product update kar rahe hain.
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedProduct) {
        throw new Error("Product not found.");
      }

      return updatedProduct;
    } catch (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  /**
   * Product permanently delete karega.
   *
   * @param {String} productId
   * @returns {Promise<Object>}
   */
  async deleteProduct(productId) {
    try {
      // Product ID mandatory hai.
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      // Database se product delete kar rahe hain.
      const deletedProduct = await Product.findByIdAndDelete(productId);

      if (!deletedProduct) {
        throw new Error("Product not found.");
      }

      return deletedProduct;
    } catch (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }
}

// Single instance export kar rahe hain.
// Isse poori application me ek hi service object use hoga.
module.exports = new ProductService();