const express = require("express");

// Router create kar rahe hain.
const router = express.Router();

// Inventory controller functions import kar rahe hain.

const validateInventory = require("../middlewares/validateInventory.middleware");
const {
  createInventory,
  getAllInventory,
  updateInventory,
} = require("../controllers/inventory.controller");

/**
 * ======================================================
 * INVENTORY ROUTES
 * ------------------------------------------------------
 * Yahan inventory related saare API endpoints define honge.
 * ======================================================
 */

/**
 * ------------------------------------------------------
 * Naya inventory create karega.
 *
 * POST /api/v1/inventory
 * ------------------------------------------------------
 */
// Naya inventory create karne se pehle request validate hogi.
router.post("/", validateInventory, createInventory);

/**
 * ------------------------------------------------------
 * Saare inventory records fetch karega.
 *
 * GET /api/v1/inventory
 * ------------------------------------------------------
 */
router.get("/", getAllInventory);
// Existing inventory update karne se pehle request validate hogi.
router.put("/:id", validateInventory, updateInventory);


// Router export kar rahe hain.
module.exports = router;