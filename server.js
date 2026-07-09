// Load environment variables from .env
require("dotenv").config();

// Import the Express app
const app = require("./src/app");

// Import MongoDB connection function
const connectDB = require("./config/db");

// Define the port
const PORT = process.env.PORT || 5000;

// Start the application
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Start Express server only after DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server");
    console.error(error.message);
    process.exit(1);
  }
};

startServer();

// Handle unexpected promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
  process.exit(1);
});

// Handle unexpected synchronous errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});