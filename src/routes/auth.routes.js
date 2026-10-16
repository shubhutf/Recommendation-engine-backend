const router = require("express").Router();
const Joi = require("joi");
const { rateLimit } = require("express-rate-limit");
const User = require("../models/user.model");
const { hashPassword, verifyPassword, issueToken, publicUser } = require("../services/auth.service");
const { requireAuth } = require("../middlewares/auth.middleware");
const credentials = Joi.object({ email: Joi.string().email().max(254).required(), password: Joi.string().min(10).max(128).required() });
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false });
router.post(["/register", "/login"], limiter, async (req, res, next) => {
  const { value, error } = credentials.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  const email = value.email.trim().toLowerCase();
  try {
    let user;
    if (req.path === "/register") {
      user = await User.create({ email, passwordHash: await hashPassword(value.password), role: "customer" });
    } else {
      user = await User.findOne({ email }).select("+passwordHash");
      // Still run scrypt for unknown emails to reduce account-enumeration timing differences.
      const stored = user?.passwordHash || `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;
      if (!(await verifyPassword(value.password, stored)) || !user) return res.status(401).json({ message: "Invalid email or password" });
    }
    return res.status(req.path === "/register" ? 201 : 200).json({ token: issueToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "An account with this email already exists" });
    return next(err);
  }
});
router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
module.exports = router;
