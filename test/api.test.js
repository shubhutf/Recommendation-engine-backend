const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
process.env.JWT_SECRET = "local-integration-test-key-not-for-deployment";
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(".local/mongodb-binaries");
delete process.env.GEMINI_API_KEY;
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const User = require("../src/models/user.model");
const Product = require("../src/models/product.model");
const Inventory = require("../src/models/inventory.model");
const Event = require("../src/models/event.model");
const { hashPassword, issueToken } = require("../src/services/auth.service");
const { drain } = require("../src/services/event.service");
const { getRecommendations } = require("../recommendationService");
let mongo, products, customer, admin, customerToken, adminToken;
const bearer = token => `Bearer ${token}`;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "recommendation_engine_test" });
  await Promise.all([User.init(), Event.init(), Product.init(), Inventory.init()]);
  const registered = await request(app).post("/api/v1/auth/register").send({ email: "customer@example.com", password: "correct-long-password" });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  customer = await User.findById(registered.body.user.id);
  customerToken = registered.body.token;
  admin = await User.create({ email: "admin@example.com", passwordHash: await hashPassword("admin-long-password"), role: "admin" });
  adminToken = issueToken(admin);
  products = await Product.insertMany(Array.from({ length: 9 }, (_, i) => ({ productName: `Test product ${i}`, category: i === 8 ? "Other" : "Dairy", brand: i % 2 ? "Brand B" : "Brand A", price: 50 + i * 10, rating: 4.2 })));
  await Inventory.insertMany(products.map((p, i) => ({ productId: p._id, availableQuantity: i === 7 ? 0 : 10 })));
}, { timeout: 120000 });
after(async () => { await drain(); await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("registration cannot elevate roles, login and /me use real identity", async () => {
  const invalid = await request(app).post("/api/v1/auth/register").send({ email: "elevate@example.com", password: "long-password", role: "admin" });
  assert.equal(invalid.status, 400);
  const login = await request(app).post("/api/v1/auth/login").send({ email: "CUSTOMER@example.com", password: "correct-long-password" });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, "customer");
  assert.equal(login.body.user.passwordHash, undefined);
  assert.equal((await request(app).post("/api/v1/auth/login").set("Authorization", "Bearer expired-token").send({ email: "customer@example.com", password: "correct-long-password" })).status, 200);
  assert.equal((await request(app).get("/api/v1/auth/me").set("Authorization", bearer(customerToken))).body.user.id, String(customer._id));
  assert.equal((await request(app).post("/api/v1/auth/login").send({ email: "customer@example.com", password: "wrong-long-password" })).status, 401);
});
test("all product and inventory mutations require admin", async () => {
  for (const [method, url] of [["post", "/products"], ["put", `/products/${products[0]._id}`], ["delete", `/products/${products[0]._id}`], ["post", "/inventory"], ["put", "/inventory/0123456789abcdef01234567"]]) {
    assert.equal((await request(app)[method](`/api/v1${url}`).send({})).status, 401);
    assert.equal((await request(app)[method](`/api/v1${url}`).set("Authorization", bearer(customerToken)).send({})).status, 403);
  }
  const created = await request(app).post("/api/v1/products").set("Authorization", bearer(adminToken)).send({ productName: "Admin product", category: "Test", brand: "Brand", price: 40, rating: 4 });
  assert.equal(created.status, 201);
});
test("anonymous uses exact baseline, attributed outcomes are idempotent and isolated", async () => {
  const url = `/api/v1/recommendations/${products[0]._id}`;
  const anonymous = await request(app).get(url);
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.body.engine, "rules");
  assert.equal(anonymous.body.fallbackReason, "anonymous");
  const all = products.map(p => p.toObject());
  const stock = Object.fromEntries(products.map((p, i) => [String(p._id), { availableQuantity: i === 7 ? 0 : 10 }]));
  assert.deepEqual(anonymous.body.recommendations.map(r => r.productId), getRecommendations(products[0]._id, all, stock).map(r => String(r.productId)));
  const result = await request(app).get(url).set("Authorization", bearer(customerToken));
  assert.equal(result.body.fallbackReason, "cold_start");
  const rec = result.body.recommendations[0];
  const event = { eventType: "CLICK", productId: rec.productId, impressionId: rec.impressionId };
  assert.equal((await request(app).post("/api/v1/events").set("Authorization", bearer(customerToken)).send({ ...event, source: "simulated" })).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await request(app).post("/api/v1/events").set("Authorization", bearer(customerToken)).send(event)).status, 202);
  assert.equal(await Event.countDocuments({ impressionId: rec.impressionId, eventType: "CLICK" }), 1);
  assert.equal((await request(app).post("/api/v1/events").set("Authorization", bearer(adminToken)).send(event)).status, 404);
  assert.equal((await request(app).post("/api/v1/events").set("Authorization", bearer(customerToken)).send({ ...event, eventType: "FEEDBACK", feedback: "helpful" })).status, 202);
  await drain();
  assert.ok(await mongoose.connection.db.collection("recommendations").countDocuments({ source: "real" }) >= 6);
  const summary = (await request(app).get("/api/v1/analytics/summary")).body;
  assert.equal(summary.interactions.totals.CLICK, 1);
  assert.equal(summary.interactions.source, "real");
  await Event.create({ userId: customer._id, eventType: "CLICK", productId: products[2]._id, source: "simulated" });
  const afterSimulated = (await request(app).get("/api/v1/analytics/summary")).body;
  assert.equal(afterSimulated.interactions.totals.CLICK, 1);
});
test("warm users get scoring, malformed/slow/unavailable scorers fall back", async () => {
  const { snapshot } = require("../src/services/event.service");
  await Event.insertMany(products.slice(1, 7).map(p => ({ userId: customer._id, eventType: "CLICK", productId: p._id, productSnapshot: snapshot(p), source: "real", timestamp: new Date(Date.now() - 60000) })));
  const originalFetch = global.fetch;
  process.env.ML_SERVICE_URL = "http://127.0.0.1:8000";
  try {
    global.fetch = async (_, options) => {
      const body = JSON.parse(options.body);
      assert.ok(body.candidates.every(p => p.availableQuantity > 0 && p.category === "Dairy"));
      return { ok: true, json: async () => ({ modelVersion: "v1-test", trainingSource: "simulated", scores: body.candidates.map((p, i) => ({ productId: p._id, score: i })) }) };
    };
    let response = await request(app).get(`/api/v1/recommendations/${products[0]._id}`).set("Authorization", bearer(customerToken));
    assert.equal(response.body.engine, "ml");
    assert.equal(response.body.recommendations.length, 3);
    assert.ok(response.body.recommendations.every(r => r.product.availableQuantity > 0));
    global.fetch = async () => ({ ok: true, json: async () => ({ scores: [{ productId: "unrequested", score: 100 }] }) });
    response = await request(app).get(`/api/v1/recommendations/${products[0]._id}`).set("Authorization", bearer(customerToken));
    assert.equal(response.body.engine, "rules");
    assert.equal(response.body.fallbackReason, "ml_unavailable");
    global.fetch = async () => { const error = new Error("test timeout"); error.name = "TimeoutError"; throw error; };
    response = await request(app).get(`/api/v1/recommendations/${products[0]._id}`).set("Authorization", bearer(customerToken));
    assert.equal(response.body.fallbackReason, "ml_timeout");
    global.fetch = async () => { throw new Error("connection refused"); };
    assert.equal((await request(app).get(`/api/v1/recommendations/${products[0]._id}`).set("Authorization", bearer(customerToken))).body.engine, "rules");
  } finally { global.fetch = originalFetch; delete process.env.ML_SERVICE_URL; }
});
test("product delete removes inventory and legacy links, retains event snapshots", async () => {
  await drain();
  const id = products[0]._id;
  assert.equal((await request(app).delete(`/api/v1/products/${id}`).set("Authorization", bearer(adminToken))).status, 200);
  assert.equal(await Inventory.countDocuments({ productId: id }), 0);
  assert.equal(await mongoose.connection.db.collection("recommendations").countDocuments({ sourceProductId: id }), 0);
  assert.ok(await Event.countDocuments({ sourceProductId: id }) > 0);
});
test("an actual slow HTTP scorer hits the configured deadline", async () => {
  const http = require("node:http");
  const server = http.createServer((req, res) => { setTimeout(() => { res.writeHead(200); res.end("{}"); }, 500); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.ML_TIMEOUT_MS = "100";
  const started = Date.now();
  try {
    const { scoreCandidates } = require("../src/services/ml.service");
    const candidates = products.slice(2, 6).map(p => ({ ...p.toObject(), availableQuantity: 10 }));
    const result = await scoreCandidates(products[1].toObject(), candidates, customer, new Date());
    assert.equal(result.reason, "ml_timeout");
    assert.ok(Date.now() - started < 450);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    delete process.env.ML_SERVICE_URL; delete process.env.ML_TIMEOUT_MS;
  }
});
test("ML insights uses actual saved metadata", async () => {
  const response = await request(app).get("/api/v1/ml/insights");
  assert.equal(response.status, 200);
  assert.equal(response.body.training_source, "simulated");
  assert.equal(response.body.features.length, 13);
  assert.ok(response.body.metrics.requests > 0);
});
test("recommendation responses do not wait for impression persistence", async () => {
  const originalInsert = Event.insertMany;
  let release;
  Event.insertMany = () => new Promise(resolve => { release = resolve; });
  try {
    const response = await request(app).get(`/api/v1/recommendations/${products[1]._id}`).timeout({ deadline: 1000 });
    assert.equal(response.status, 200);
    assert.ok(require("../src/services/event.service").queueStats().pending > 0);
  } finally {
    if (release) release([]);
    Event.insertMany = originalInsert;
    await drain();
  }
});
