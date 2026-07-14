const mongoose = require("mongoose");

/**
 * ======================================================
 * INVENTORY SCHEMA
 * ------------------------------------------------------
 * Har product ka available stock yahan maintain hoga.
 * Product aur Inventory ka relation productId ke through hoga.
 * ======================================================
 */

const InventorySchema = new mongoose.Schema(
  {
    // Kis product ka inventory hai
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      unique: true,
    },

    // Available stock quantity
    availableQuantity: {
      type: Number,
      required: [true, "Available quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
  },
  {
    // createdAt aur updatedAt automatically maintain honge
    timestamps: true,
  }
);

/**
 * ======================================================
 * INDEXES
 * ------------------------------------------------------
 * Product ke basis par inventory jaldi search hogi.
 * ======================================================
 */

/**
 * Inventory model export kar rahe hain.
 */
module.exports = mongoose.model("Inventory", InventorySchema, "inventory");