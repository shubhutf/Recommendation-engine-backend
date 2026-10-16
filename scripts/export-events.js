require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const mongoose = require("mongoose");
const Event = require("../src/models/event.model");
async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "recommendation_engine" });
  const output = path.resolve("ml-service/data/real-events.jsonl");
  const stream = fs.createWriteStream(output, { flags: "wx" });
  let rows = 0;
  for await (const row of Event.find({ source: "real", userId: { $ne: null }, productSnapshot: { $exists: true } }).sort({ timestamp: 1 }).lean().cursor()) {
    // No email/password is exported. IDs remain pseudonymous personal data; keep local.
    if (!stream.write(JSON.stringify(row) + "\n")) await once(stream, "drain");
    rows++;
  }
  stream.end(); await once(stream, "finish");
  console.log(`Exported ${rows} real events to ignored file ${output}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
