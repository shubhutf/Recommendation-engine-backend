const mongoose = require("mongoose");
const User = require("../models/user.model");
const { verifyToken } = require("../services/auth.service");
async function optionalAuth(req, res, next) {
  if (["/api/v1/auth/login", "/api/v1/auth/register"].includes(req.path)) return next();
  if (!req.headers.authorization) return next();
  try {
    const match = /^Bearer (\S+)$/.exec(req.headers.authorization);
    if (!match) return res.status(401).json({ message: "Invalid authorization header" });
    const token = verifyToken(match[1]);
    if (!mongoose.isObjectIdOrHexString(token.sub)) throw new Error("Invalid subject");
    const user = await User.findById(token.sub).lean();
    if (!user) return res.status(401).json({ message: "Account no longer exists" });
    req.user = user;
    return next();
  } catch (error) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name) || error.message === "Invalid subject") {
      return res.status(401).json({ message: "Session expired or invalid. Please sign in." });
    }
    return next(error);
  }
}
function requireAuth(req, res, next) {
  return req.user ? next() : res.status(401).json({ message: "Sign in required" });
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Sign in required" });
  return req.user.role === "admin" ? next() : res.status(403).json({ message: "Admin role required" });
}
module.exports = { optionalAuth, requireAuth, requireAdmin };
