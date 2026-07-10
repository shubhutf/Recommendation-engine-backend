/**
 * ======================================================
 * CUSTOM API ERROR CLASS
 * ------------------------------------------------------
 * Is class ka use poori application me custom errors
 * throw karne ke liye hoga.
 *
 * Isse status code aur error message ek hi object me
 * store ho jayega.
 * ======================================================
 */

class ApiError extends Error {
  /**
   * ------------------------------------------------------
   * Constructor
   *
   * statusCode -> HTTP Status Code
   * message -> Error Message
   * ------------------------------------------------------
   */
  constructor(statusCode, message) {
    super(message);

    this.statusCode = statusCode;

    // Error ka naam automatically class ke naam se set hoga.
    this.name = this.constructor.name;

    // Proper stack trace maintain karega.
    Error.captureStackTrace(this, this.constructor);
  }
}

// Export
module.exports = ApiError;