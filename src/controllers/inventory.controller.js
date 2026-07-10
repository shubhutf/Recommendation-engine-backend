const inventoryService = require("../services/inventory.service");
const ApiResponse = require("../utils/ApiResponse");

/**
 * ======================================================
 * INVENTORY CONTROLLER
 * ------------------------------------------------------
 * Yahan sirf request aur response handle hoga.
 * Inventory ki business logic service layer me hai.
 * ======================================================
 */

/**
 * ------------------------------------------------------
 * Naya inventory record create karega.
 *
 * Endpoint:
 * POST /api/v1/inventory
 * ------------------------------------------------------
 */
const createInventory = async (req, res, next) => {
  try {

    // Request body se inventory data le rahe hain.
    const inventoryData = req.body;

    // Service call karke inventory create kar rahe hain.
    const inventory =
      await inventoryService.createInventory(inventoryData);

    // Success response bhej rahe hain.
    res.status(201).json(
      new ApiResponse(
        201,
        "Inventory created successfully.",
        inventory
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------
 * Saare inventory records fetch karega.
 *
 * Endpoint:
 * GET /api/v1/inventory
 * ------------------------------------------------------
 */
const getAllInventory = async (req, res, next) => {
  try {

    // Service call karke saare inventory records fetch kar rahe hain.
    const inventory =
      await inventoryService.getAllInventory();

    res.status(200).json(
      new ApiResponse(
        200,
        "Inventory fetched successfully.",
        inventory
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * ------------------------------------------------------
 * Existing inventory update karega.
 *
 * Endpoint:
 * PUT /api/v1/inventory/:id
 * ------------------------------------------------------
 */
const updateInventory = async (req, res, next) => {
  try {

    // URL se inventory id le rahe hain.
    const { id } = req.params;

    // Request body se updated data le rahe hain.
    const updateData = req.body;

    // Service call karke inventory update kar rahe hain.
    const updatedInventory =
      await inventoryService.updateInventory(
        id,
        updateData
      );

    res.status(200).json(
      new ApiResponse(
        200,
        "Inventory updated successfully.",
        updatedInventory
      )
    );

  } catch (error) {
    next(error);
  }
};

/**
 * Controller functions export kar rahe hain.
 */
module.exports = {
  createInventory,
  getAllInventory,
  updateInventory,
};