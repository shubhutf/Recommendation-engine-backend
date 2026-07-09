const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");

    // Environment variable se MongoDB URI le rahe hain.
  console.log("MongoDB URI loaded");

    // MongoDB database se connection establish kar rahe hain.
   const conn = await mongoose.connect(process.env.MONGO_URI, {
  family: 4
});

    console.log("Connected");
    console.log(conn.connection.readyState);
    console.log(conn.connection.host);

  } catch (err) {
    console.error(err);
    throw err;
    }
};

module.exports = connectDB;