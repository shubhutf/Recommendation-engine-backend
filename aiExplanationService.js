// Gemini-backed explanation helper for recommendations.
// If Gemini is unavailable, this falls back to a local explanation so the API still works.

const https = require("https");

function buildFallbackExplanation(sourceProduct, recommendedProduct, breakdown) {
  if (!sourceProduct || !recommendedProduct) {
    return "Recommendation explanation is unavailable.";
  }

  const parts = [];

  if (sourceProduct.category === recommendedProduct.category) {
    parts.push(`same category (${recommendedProduct.category})`);
  }

  if (typeof sourceProduct.price === "number" && typeof recommendedProduct.price === "number") {
    const priceDiff = Math.abs(recommendedProduct.price - sourceProduct.price);
    parts.push(`close price difference of ${priceDiff}`);
  }

  if (typeof recommendedProduct.rating === "number") {
    parts.push(`rating ${recommendedProduct.rating}/5`);
  }

  if (breakdown && breakdown.inventoryScore === 1) {
    parts.push("in stock");
  }

  if (parts.length === 0) {
    return "Recommended based on overall product similarity.";
  }

  return `Recommended because it has ${parts.join(", ")}.`;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 0,
            body: data,
          });
        });
      }
    );

    request.on("error", reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

async function buildGeminiExplanation(sourceProduct, recommendedProduct, breakdown) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallbackExplanation(sourceProduct, recommendedProduct, breakdown);
  }

  const prompt = [
    "You are explaining why a product recommendation was made.",
    "Return one short sentence in plain English.",
    "Do not mention that you are an AI model.",
    "Do not invent facts not present in the data.",
    "",
    `Source product: ${JSON.stringify(sourceProduct)}`,
    `Recommended product: ${JSON.stringify(recommendedProduct)}`,
    `Scoring breakdown: ${JSON.stringify(breakdown)}`,
  ].join("\n");

  const url =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await postJson(url, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 200,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.error("Gemini API error:", response.statusCode, response.body);
      return buildFallbackExplanation(sourceProduct, recommendedProduct, breakdown);
    }

    const payload = safeJsonParse(response.body);
    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join(" ")
        ?.trim();

    return text || buildFallbackExplanation(sourceProduct, recommendedProduct, breakdown);
  } catch (err) {
    console.error("Gemini request failed:", err.message);
    return buildFallbackExplanation(sourceProduct, recommendedProduct, breakdown);
  }
}

module.exports = {
  buildRecommendationExplanation: buildGeminiExplanation,
};
