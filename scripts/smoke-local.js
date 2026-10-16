// Exercise the actual Node → FastAPI → saved XGBoost model path using real HTTP.
// Refuses connected databases: these generated QA interactions belong only in the disposable demo.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { randomBytes } = require("node:crypto");
const base = "http://127.0.0.1:5000/api/v1";
let token;
async function call(url, body) {
  const response = await fetch(base + url, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify({ status: response.status, message: data.message }));
  return data;
}
async function main() {
  assert.equal((await call("/health")).dataMode, "disposable-demo", "Only run against npm run dev:local");
  const products = (await call("/products?limit=200")).data.products;
  const anonymous = await call(`/recommendations/${products[0]._id}`);
  assert.equal(anonymous.fallbackReason, "anonymous");
  const account = await call("/auth/register", { email: `smoke-${Date.now()}@example.com`, password: randomBytes(24).toString("hex") });
  token = account.token;
  const cold = await call(`/recommendations/${products[0]._id}`);
  assert.equal(cold.fallbackReason, "cold_start");
  const clicked = new Set();
  for (const product of products) {
    const result = await call(`/recommendations/${product._id}`);
    for (const rec of result.recommendations) {
      if (clicked.has(rec.productId)) continue;
      await call("/events", { eventType: "CLICK", productId: rec.productId, impressionId: rec.impressionId });
      clicked.add(rec.productId);
    }
    if (clicked.size >= 6) break;
  }
  const warm = await call(`/recommendations/${products[0]._id}`);
  assert.equal(warm.engine, "ml", JSON.stringify({ engine: warm.engine, reason: warm.fallbackReason }));
  assert.equal(warm.recommendations.length, 3);
  assert.ok(warm.recommendations.every(r => r.product.category === products[0].category && r.product.availableQuantity > 0 && Number.isFinite(r.modelScore)));
  await call("/events", { eventType: "FEEDBACK", productId: warm.recommendations[0].productId, impressionId: warm.recommendations[0].impressionId, feedback: "helpful" });
  const insights = await call("/ml/insights");
  assert.equal(warm.modelVersion, insights.version);
  const summary = await call("/analytics/summary");
  assert.ok(summary.interactions.totals.CLICK >= clicked.size);
  const report = { ran_at: new Date().toISOString(), environment: "disposable-demo; automated QA only", model_version: warm.modelVersion,
    anonymous_engine: anonymous.engine, cold_start_engine: cold.engine, warm_engine: warm.engine,
    distinct_clicked_products: clicked.size, recommendations: warm.recommendations.map(r => ({ productId: r.productId, modelScore: r.modelScore })),
    checks: ["registration", "anonymous rules", "authenticated cold start", "attributed clicks", "actual Python scoring", "stock/category filters", "feedback", "artifact API", "real-event analytics"] };
  await fs.mkdir("docs", { recursive: true });
  await fs.writeFile("docs/LOCAL_SMOKE.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
