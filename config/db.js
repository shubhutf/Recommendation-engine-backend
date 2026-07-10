const mongoose = require("mongoose");
const dns = require("dns");

// FORCE NODE TO USE GOOGLE DNS TO BYPASS ISP BLOCKS
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing from your environment variables!");
    }

    console.log("MongoDB URI loaded");

    // Force IPv4 connection
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      family: 4
    });

    console.log("Connected Successfully!");
    console.log(`Database Host: ${conn.connection.host}`);

  } catch (err) {
    console.error("❌ Database connection error details:", err.message);
    throw err;
  }
};

module.exports = connectDB;