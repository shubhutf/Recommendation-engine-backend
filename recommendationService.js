// Recommendation scoring helpers for the backend.
// This file keeps the logic separate from the API route so it is easier to test and reuse.
function calculateRecommendationScore(sourceProduct, candidateProduct, inventoryMap) {
  // Skip invalid inputs early.
  if (!sourceProduct || !candidateProduct) {
    return null;
  }

  // Only recommend products from the same category.
  if (candidateProduct.category !== sourceProduct.category) {
    return null;
  }

  // Never recommend the same product back to itself.
  if (String(candidateProduct._id) === String(sourceProduct._id)) {
    return null;
  }

  // Category is already filtered, so it gets the full weight.
  const categoryScore = 1.0;

  // Products closer in price score higher.
  // Cheaper alternatives get a small bonus.
  const sourcePrice = Number(sourceProduct.price);
  const candidatePrice = Number(candidateProduct.price);
  const priceDiff = Math.abs(candidatePrice - sourcePrice);
  const priceRange = Math.max(sourcePrice, 1);
  let priceScore = Math.max(0, 1 - priceDiff / priceRange);
  if (candidatePrice < sourcePrice) {
    priceScore = Math.min(1, priceScore + 0.1);
  }

  // Normalize rating from 0-5 into 0-1.
  const ratingScore = Math.max(0, Math.min(1, Number(candidateProduct.rating) / 5));

  // In-stock products get the full inventory score.
  const stock = inventoryMap[String(candidateProduct._id)];
  const inventoryScore = stock && stock.availableQuantity > 0 ? 1 : 0;

  // Final weighted score based on the project rules.
  const finalScore =
    categoryScore * 0.4 +
    priceScore * 0.2 +
    ratingScore * 0.2 +
    inventoryScore * 0.2;

  return {
    productId: candidateProduct._id,
    score: Number(finalScore.toFixed(3)),
    breakdown: {
      categoryScore,
      priceScore: Number(priceScore.toFixed(3)),
      ratingScore: Number(ratingScore.toFixed(3)),
      inventoryScore,
    },
  };
}

function getRecommendations(sourceProductId, allProducts, inventoryMap, topN = 3) {
  // Find the source product first.
  const sourceProduct = allProducts.find((product) => String(product._id) === String(sourceProductId));
  if (!sourceProduct) {
    return [];
  }

  // Score every product against the source product.
  const scored = allProducts
    .map((candidateProduct) =>
      calculateRecommendationScore(sourceProduct, candidateProduct, inventoryMap)
    )
    .filter(Boolean);

  // Sort in-stock products first, then by score.
  scored.sort((a, b) => {
    const aStock = a.breakdown.inventoryScore;
    const bStock = b.breakdown.inventoryScore;

    if (aStock !== bStock) {
      return bStock - aStock;
    }

    return b.score - a.score;
  });

  return scored.slice(0, topN);
}

module.exports = {
  calculateRecommendationScore,
  getRecommendations,
};
