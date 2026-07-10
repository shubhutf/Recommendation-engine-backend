const Inventory = require("../models/inventory.model");

/**
 * ======================================================
 * INVENTORY SERVICE
 * ------------------------------------------------------
 * Yahan inventory ki saari business logic handle hogi.
 * Controller sirf request aur response manage karega.
 * ======================================================
 */

class InventoryService {

  /**
   * ======================================================
   * Naya inventory record create karega.
   * ======================================================
   */
  async createInventory(inventoryData) {
    try {

      // Inventory document database me save kar rahe hain.
      const inventory = await Inventory.create(inventoryData);

      return inventory;

    } catch (error) {
      throw new Error(`Failed to create inventory: ${error.message}`);
    }
  }

  /**
   * ======================================================
   * Saare inventory records fetch karega.
   * ======================================================
   */
  async getAllInventory() {
    try {

      // Product details bhi saath me fetch kar rahe hain.
      const inventory = await Inventory.find()
        .populate("productId")
        .lean();

      return inventory;

    } catch (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`);
    }
  }

  /**
   * ======================================================
   * Existing inventory update karega.
   * ======================================================
   */
  async updateInventory(id, updateData) {
    try {

      if (!id) {
        throw new Error("Inventory ID is required.");
      }

      const updatedInventory =
        await Inventory.findByIdAndUpdate(
          id,
          updateData,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!updatedInventory) {
        throw new Error("Inventory not found.");
      }

      return updatedInventory;

    } catch (error) {
      throw new Error(`Failed to update inventory: ${error.message}`);
    }
  }

}

/**
 * Single instance export kar rahe hain.
 */
module.exports = new InventoryService();