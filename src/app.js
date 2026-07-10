// Load required packages
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
// Product routes import kar rahe hain
const productRoutes = require("./routes/product.routes");
// Global error handler middleware import kar rahe hain.
const errorHandler = require("./middlewares/errorHandler.middleware");

// Create Express application
const app = express();

// Recommendation routes import kar rahe hain.
const recommendationRoutes = require("./routes/recommendation.routes");

// Inventory routes import kar rahe hain.
const inventoryRoutes = require("./routes/inventory.routes");
// Security middleware
app.use(helmet());

// Enable CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

// Parse incoming JSON requests
app.use(express.json({ limit: "10kb" }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Health Check Route
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});
// Product related APIs
// Base URL: /api/v1/products
app.use("/api/v1/products", productRoutes);

// Recommendation related APIs
// Base URL: /api/v1/recommendations
app.use("/api/v1/recommendations", recommendationRoutes);

// Inventory related APIs
// Base URL: /api/v1/inventory
app.use("/api/v1/inventory", inventoryRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot find ${req.originalUrl}`,
  });
});

/**
 * ======================================================
 * GLOBAL ERROR HANDLER
 * ------------------------------------------------------
 * Application me jitne bhi errors aayenge,
 * sab yahin handle honge.
 * ======================================================
 */
app.use(errorHandler);

module.exports = app;