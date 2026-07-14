/**
 * ======================================================
 * GLOBAL ERROR HANDLER
 * ------------------------------------------------------
 * Puri application me jitne bhi errors aayenge,
 * unko ek hi jagah handle kiya jayega.
 *
 * Isse controllers aur services clean rahenge.
 * ======================================================
 */

const errorHandler = (err, req, res, next) => {
  // Default values
  console.error(err); 
  let statusCode = err.statusCode || 500;

  let message = err.message || "Internal Server Error";

  /**
   * ------------------------------------------------------
   * MONGOOSE VALIDATION ERROR
   *
   * Schema validation fail hone par ye error aata hai.
   * ------------------------------------------------------
   */
  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
  }

  /**
   * ------------------------------------------------------
   * INVALID OBJECT ID
   *
   * Agar invalid MongoDB ObjectId pass hoti hai.
   * ------------------------------------------------------
   */
  if (err.name === "CastError") {
    statusCode = 400;

    message = "Invalid resource id.";
  }

  /**
   * ------------------------------------------------------
   * DUPLICATE KEY ERROR
   *
   * MongoDB duplicate unique value save karne par.
   * ------------------------------------------------------
   */
  if (err.code === 11000) {
    statusCode = 400;

    const field = Object.keys(err.keyValue)[0];

    message = `${field} already exists.`;
  }

  /**
   * ------------------------------------------------------
   * FINAL ERROR RESPONSE
   * ------------------------------------------------------
   */
  res.status(statusCode).json({
    success: false,
    message,
  });
};

// Export middleware
module.exports = errorHandler;