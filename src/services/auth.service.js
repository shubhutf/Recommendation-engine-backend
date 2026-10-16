const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const jwt = require("jsonwebtoken");
const scrypt = promisify(scryptCallback);

function secret() {
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  return process.env.JWT_SECRET;
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [algorithm, salt, hash] = (stored || "").split("$");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(hash, "hex"));
}
function issueToken(user) {
  return jwt.sign({}, secret(), {
    algorithm: "HS256", subject: String(user._id), issuer: "restock-api", audience: "restock-web",
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });
}
function verifyToken(token) {
  return jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: "restock-api", audience: "restock-web" });
}
function publicUser(user) { return { id: String(user._id), email: user.email, role: user.role }; }
module.exports = { hashPassword, verifyPassword, issueToken, verifyToken, publicUser, secret };
