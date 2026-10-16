const router = require("express").Router();
const fs = require("node:fs/promises");
const path = require("node:path");
router.get("/insights", async (req, res, next) => {
  try {
    const directory = path.resolve(__dirname, "../..", "ml-service/artifacts");
    const [metadata, evaluation] = await Promise.all(["metadata.json", "evaluation.json"].map(file => fs.readFile(path.join(directory, file), "utf8").then(JSON.parse)));
    return res.json({ ...metadata, evaluation, coldStart: { minimumDistinctProducts: Math.max(1, Number(process.env.ML_MIN_HISTORY) || 5),
      explanation: "Anonymous users and users with too few distinct positively interacted products use the permanent rule-based engine. Timeouts and scoring errors also fall back automatically." } });
  } catch (error) {
    if (error.code === "ENOENT") return res.status(503).json({ message: "No evaluated model artifact available. Run the training pipeline." });
    return next(error);
  }
});
module.exports = router;
