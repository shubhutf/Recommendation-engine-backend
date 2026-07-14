const Joi = require("joi");

/**
 * =====================================================
 * PRODUCT CREATE VALIDATION SCHEMA
 * -----------------------------------------------------
 * Naya product create karte time request body validate
 * karega.
 * Agar required fields missing hongi ya invalid hongi
 * to request yahin reject ho jayegi.
 * =====================================================
 */
const createProductSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(100).required(),

  category: Joi.string().trim().required(),

  brand: Joi.string().trim().required(),

  size: Joi.string().trim().optional(), // not part of the real data model — kept optional, not removed, in case other products use it

  price: Joi.number().min(0).required(),

  rating: Joi.number().min(0).max(5).optional(),

  imageUrl: Joi.string().trim().uri().optional(), // was completely missing — every real product has this
});

/**
 * =====================================================
 * PRODUCT UPDATE VALIDATION SCHEMA
 * -----------------------------------------------------
 * Product update karte time saari fields optional hongi.
 * User sirf wahi fields bhej sakta hai jo update karni
 * hain.
 * =====================================================
 */
const updateProductSchema = Joi.object({
  productName: Joi.string().trim().min(2).max(100),

  category: Joi.string().trim(),

  brand: Joi.string().trim(),

  size: Joi.string().trim(),

  price: Joi.number().min(0),

  rating: Joi.number().min(0).max(5),

  imageUrl: Joi.string().trim().uri(),
}).min(1);

/**
 * =====================================================
 * CREATE PRODUCT VALIDATION MIDDLEWARE
 * -----------------------------------------------------
 * Incoming request body ko validate karega.
 * Validation fail hone par controller tak request
 * nahi jayegi.
 * =====================================================
 */
const validateCreateProduct = (req, res, next) => {
  const { error } = createProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation Failed",
      errors: error.details.map((err) => err.message),
    });
  }

  next();
};

/**
 * =====================================================
 * UPDATE PRODUCT VALIDATION MIDDLEWARE
 * -----------------------------------------------------
 * Product update request validate karega.
 * Kam se kam ek field bhejna mandatory hai.
 * =====================================================
 */
const validateUpdateProduct = (req, res, next) => {
  const { error } = updateProductSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation Failed",
      errors: error.details.map((err) => err.message),
    });
  }

  next();
};

/**
 * =====================================================
 * EXPORT MIDDLEWARES
 * -----------------------------------------------------
 * Dono validation middleware ko routes me use karenge.
 * =====================================================
 */
module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
};