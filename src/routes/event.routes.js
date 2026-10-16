const router = require("express").Router();
const Joi = require("joi");
const { rateLimit } = require("express-rate-limit");
const Event = require("../models/event.model");
const Product = require("../models/product.model");
const { requireAuth } = require("../middlewares/auth.middleware");
const { snapshot } = require("../services/event.service");
const schema = Joi.object({
  eventType: Joi.string().valid("VIEW", "CLICK", "CART", "PURCHASE", "FEEDBACK").required(),
  productId: Joi.string().hex().length(24).required(),
  impressionId: Joi.string().uuid(),
  feedback: Joi.when("eventType", { is: "FEEDBACK", then: Joi.string().valid("helpful", "not-helpful").required(), otherwise: Joi.forbidden() }),
});
router.post("/", requireAuth, rateLimit({ windowMs: 60000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }), async (req, res, next) => {
  const { value, error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  try {
    const base = { eventType: value.eventType, productId: value.productId, userId: req.user._id, source: "real", timestamp: new Date() };
    if (value.eventType === "VIEW" && !value.impressionId) {
      const product = await Product.findById(value.productId).lean();
      if (!product) return res.status(404).json({ message: "Product not found" });
      await Event.create({ ...base, productSnapshot: snapshot(product) });
    } else {
      if (!value.impressionId) return res.status(400).json({ message: "An impressionId is required for recommendation outcomes" });
      // Attribution is server-owned: users cannot forge engine, position, user, score or time.
      let impression = await Event.findOne({ impressionId: value.impressionId, eventType: "IMPRESSION", userId: req.user._id, productId: value.productId, source: "real" }).lean();
      // An outcome can race a deferred impression write. Only drain the bounded queue on this rare path.
      if (!impression) {
        await require("../services/event.service").drain();
        impression = await Event.findOne({ impressionId: value.impressionId, eventType: "IMPRESSION", userId: req.user._id, productId: value.productId, source: "real" }).lean();
      }
      if (!impression) return res.status(404).json({ message: "Impression not found for this account and product" });
      const { _id, __v, ...attribution } = impression;
      const row = { ...attribution, ...base, feedback: value.feedback };
      await Event.updateOne({ impressionId: value.impressionId, eventType: value.eventType }, { $setOnInsert: row }, { upsert: true });
      if (value.eventType === "FEEDBACK") await Event.updateOne({ impressionId: value.impressionId, eventType: "FEEDBACK" }, { $set: { feedback: value.feedback } });
    }
    return res.status(202).json({ accepted: true });
  } catch (err) {
    if (err.code === 11000) return res.status(202).json({ accepted: true });
    return next(err);
  }
});
module.exports = router;
