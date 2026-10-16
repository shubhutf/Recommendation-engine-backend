// Disposable local demo: no Atlas URI, no persisted password, no simulated events in Mongo.
const path = require("node:path");
const { randomBytes } = require("node:crypto");
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, "../.local/mongodb-binaries");
process.env.JWT_SECRET ||= randomBytes(48).toString("hex");
process.env.CORS_ORIGIN ||= "http://localhost:5173,http://127.0.0.1:5173";
process.env.ML_SERVICE_URL ||= "http://127.0.0.1:8000";
delete process.env.GEMINI_API_KEY;
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const catalog = require("../ml-service/data/catalog.json");
const Product = require("../src/models/product.model");
const Inventory = require("../src/models/inventory.model");
const User = require("../src/models/user.model");
const { hashPassword } = require("../src/services/auth.service");
const { drain } = require("../src/services/event.service");
const app = require("../src/app");
app.locals.disposableDemo = true;
let mongo, server;
async function main() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "recommendation_engine_demo" });
  await Promise.all([User.init(), require("../src/models/event.model").init()]);
  await Product.insertMany(catalog.map(({ availableQuantity, source, ...product }) => product));
  await Inventory.insertMany(catalog.map(p => ({ productId: p._id, availableQuantity: p.availableQuantity })));
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await User.create({ email: process.env.ADMIN_EMAIL, passwordHash: await hashPassword(process.env.ADMIN_PASSWORD), role: "admin" });
    console.log("Local admin provisioned from ADMIN_EMAIL/ADMIN_PASSWORD.");
  }
  server = app.listen(Number(process.env.PORT) || 5000, "127.0.0.1", () => console.log("Disposable demo API: http://localhost:5000/api/v1 — 128 simulated catalog products; register a customer in the UI. Data resets on exit."));
}
async function stop() {
  if (server) await new Promise(resolve => server.close(resolve));
  await drain(); await mongoose.disconnect(); if (mongo) await mongo.stop();
  process.exit();
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
main().catch(async error => { console.error(error.message); await mongoose.disconnect(); if (mongo) await mongo.stop(); process.exitCode = 1; });
