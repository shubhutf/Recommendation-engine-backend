const express = require("express");

// Router create kar rahe hain taaki product ke endpoints define kar sake.
const router = express.Router();

// Product controller functions import kar rahe hain.
const {
  createProduct,
  getAllProducts,
  updateProduct,
  deleteProduct,
} = require("../controllers/product.controller");

// Product validation middleware import kar rahe hain.
const {
  validateCreateProduct,
  validateUpdateProduct,
} = require("../middlewares/validateProduct.middleware");

/**
 * --------------------------------------------------
 * PRODUCT ROUTES
 *
 * Yahan product related saare API endpoints define honge.
 *
 * Controller request ko handle karega aur service layer
 * ke through database operations perform honge.
 *
 * Validation middleware request ko pehle validate karega.
 * Agar request valid hogi tabhi controller execute hoga.
 * --------------------------------------------------
 */

/**
 * --------------------------------------------------
 * CREATE PRODUCT
 * --------------------------------------------------
 * POST /api/v1/products
 *
 * Sabse pehle request body validate hogi.
 * Validation successful hone ke baad controller
 * product create karega.
 * --------------------------------------------------
 */
router.post("/", validateCreateProduct, createProduct);

/**
 * --------------------------------------------------
 * GET ALL PRODUCTS
 * --------------------------------------------------
 * GET /api/v1/products
 *
 * Filtering
 * Sorting
 * Pagination
 * --------------------------------------------------
 */
router.get("/", getAllProducts);

/**
 * --------------------------------------------------
 * UPDATE PRODUCT
 * --------------------------------------------------
 * PUT /api/v1/products/:id
 *
 * Pehle update request validate hogi.
 * Uske baad hi product update hoga.
 * --------------------------------------------------
 */
router.put("/:id", validateUpdateProduct, updateProduct);

/**
 * --------------------------------------------------
 * DELETE PRODUCT
 * --------------------------------------------------
 * DELETE /api/v1/products/:id
 *
 * Product permanently database se remove hoga.
 * --------------------------------------------------
 */
router.delete("/:id", deleteProduct);

/**
 * Router export kar rahe hain.
 * Isse app.js me mount kiya jayega.
 */
module.exports = router;