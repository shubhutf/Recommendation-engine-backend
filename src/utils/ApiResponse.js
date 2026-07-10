/**
 * ======================================================
 * STANDARD API RESPONSE CLASS
 * ------------------------------------------------------
 * Har successful API response same format me bhejne ke
 * liye use karenge.
 * ======================================================
 */

class ApiResponse {
  /**
   * statusCode -> HTTP status
   * message -> Success message
   * data -> Actual response data
   */
  constructor(statusCode, message, data = null) {
    this.success = true;

    this.statusCode = statusCode;

    this.message = message;

    this.data = data;
  }
}

// Export
module.exports = ApiResponse;