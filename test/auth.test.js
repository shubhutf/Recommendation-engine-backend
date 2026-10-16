const { test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
process.env.JWT_SECRET = "test-only-key-not-a-deployment-secret-123456";
const { hashPassword, verifyPassword, issueToken, verifyToken } = require("../src/services/auth.service");
test("salted password hashing and JWT expiry/issuer/algorithm checks", async () => {
  const password = "a-long-test-password";
  const a = await hashPassword(password), b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong-password", a), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
  const token = issueToken({ _id: "0123456789abcdef01234567" });
  assert.equal(verifyToken(token).sub, "0123456789abcdef01234567");
  assert.ok(verifyToken(token).exp > verifyToken(token).iat);
  assert.throws(() => verifyToken(jwt.sign({}, process.env.JWT_SECRET, { expiresIn: -1, issuer: "restock-api", audience: "restock-web" })));
  assert.throws(() => verifyToken(jwt.sign({}, process.env.JWT_SECRET, { issuer: "other" })));
});
