const productService = require("../services/product.service");

/**
 * --------------------------------------------------
 * CREATE PRODUCT CONTROLLER
 * Request se product data lega aur service layer ko
 * call karke database me naya product create karega.
 * --------------------------------------------------
 */
const createProduct = async (req, res) => {
  try {
    // Request body se product ka data extract kar rahe hain.
    const productData = req.body;

    // Business logic ke liye service layer ko call kar rahe hain.
    const product = await productService.createProduct(productData);

    // Successful creation ke baad response bhej rahe hain.
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });

  } catch (error) {
    // Agar product create karte time error aaye to error response bhejenge.
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * --------------------------------------------------
 * GET ALL PRODUCTS CONTROLLER
 * Database se products fetch karega.
 * Query parameters ke through filtering,
 * sorting aur pagination support karega.
 * --------------------------------------------------
 */
const getAllProducts = async (req, res) => {
  try {
    // URL ke query parameters receive kar rahe hain.
    // Example: category, brand, price range, page etc.
    const query = req.query;

    // Product fetch karne ke liye service call kar rahe hain.
    const result = await productService.getAllProducts(query);

    // Products aur pagination details return kar rahe hain.
    res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    // Fetch operation fail hone par error response.
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * --------------------------------------------------
 * UPDATE PRODUCT CONTROLLER
 * Product ID aur updated data lekar existing product
 * ko update karega.
 * --------------------------------------------------
 */
const updateProduct = async (req, res) => {
  try {
    // URL parameter se product ID le rahe hain.
    const productId = req.params.id;

    // Request body me updated fields milengi.
    const updateData = req.body;

    // Update operation ke liye service call.
    const updatedProduct = await productService.updateProduct(
      productId,
      updateData
    );

    // Updated product response me bhej rahe hain.
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });

  } catch (error) {
    // Update fail hone par error response.
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


/**
 * --------------------------------------------------
 * DELETE PRODUCT CONTROLLER
 * Product ID ke basis par database se product delete karega.
 * --------------------------------------------------
 */
const deleteProduct = async (req, res) => {
  try {
    // URL parameter se delete hone wale product ki ID le rahe hain.
    const productId = req.params.id;

    // Delete operation ke liye service layer ko call kar rahe hain.
    const deletedProduct = await productService.deleteProduct(productId);

    // Successful deletion ka response.
    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: deletedProduct,
    });

  } catch (error) {
    // Delete fail hone par error response.
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// Controller functions export kar rahe hain
// taaki routes file me use kiya ja sake.
module.exports = {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
};