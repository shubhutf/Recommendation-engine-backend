const Joi = require("joi");

/**
 * ======================================================
 * INVENTORY VALIDATION MIDDLEWARE
 * ------------------------------------------------------
 * Inventory create/update request ko validate karega.
 * Invalid data aane par request ko reject kar dega.
 * ======================================================
 */

const inventorySchema = Joi.object({
  productId: Joi.string()
    .required()
    .messages({
      "any.required": "Product ID is required.",
    }),

  availableQuantity: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      "number.base": "Available quantity must be a number.",
      "number.min": "Available quantity cannot be negative.",
      "any.required": "Available quantity is required.",
    }),
});

const validateInventory = (req, res, next) => {
  // Request body validate kar rahe hain.
  const { error } = inventorySchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }

  next();
};

module.exports = validateInventory;