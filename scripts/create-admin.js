require("dotenv").config();
const mongoose = require("mongoose");
const Joi = require("joi");
const User = require("../src/models/user.model");
const { hashPassword, secret } = require("../src/services/auth.service");
async function main() {
  secret();
  const { error } = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(10).max(128).required() })
    .validate({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  if (error) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (10–128 characters) in your shell");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "recommendation_engine" });
  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
  if (await User.exists({ email })) throw new Error("Account already exists; no account was changed");
  await User.create({ email, passwordHash: await hashPassword(process.env.ADMIN_PASSWORD), role: "admin" });
  console.log("Admin created. Sign in through the frontend.");
}
main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
