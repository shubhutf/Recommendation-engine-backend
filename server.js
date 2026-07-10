require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const recommendationRoutes = require("./recommendationRoutes");
const analyticsRoutes = require("./analytics/analyticsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(MONGODB_URI);

  app.use(express.json());
  app.use("/recommendations", recommendationRoutes);
  app.use("/analytics", analyticsRoutes);

  app.get("/", (req, res) => {
    res.json({ message: "Recommendation backend is running" });
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(async (err) => {
  console.error("Server failed to start:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
