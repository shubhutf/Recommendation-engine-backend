function buildAnalyticsSummary(recommendationDocs, productDocs, topN = 5) {
  const recommendationCounts = new Map();
  const sourceCounts = new Map();

  for (const doc of recommendationDocs) {
    const recommendedId = String(doc.recommendedProductId);
    const sourceId = String(doc.sourceProductId);

    recommendationCounts.set(
      recommendedId,
      (recommendationCounts.get(recommendedId) || 0) + 1
    );

    sourceCounts.set(sourceId, (sourceCounts.get(sourceId) || 0) + 1);
  }

  const productById = new Map(productDocs.map((product) => [String(product._id), product]));

  const topRecommendedProducts = [...recommendationCounts.entries()]
    .map(([productId, totalRecommendations]) => {
      const product = productById.get(productId);

      return {
        productId,
        totalRecommendations,
        productName: product?.productName || null,
        brand: product?.brand || null,
        category: product?.category || null,
        price: product?.price ?? null,
        rating: product?.rating ?? null,
      };
    })
    .sort((a, b) => b.totalRecommendations - a.totalRecommendations)
    .slice(0, topN);

  const topSourceProducts = [...sourceCounts.entries()]
    .map(([productId, totalTimesRecommended]) => {
      const product = productById.get(productId);

      return {
        productId,
        totalTimesRecommended,
        productName: product?.productName || null,
        brand: product?.brand || null,
        category: product?.category || null,
      };
    })
    .sort((a, b) => b.totalTimesRecommended - a.totalTimesRecommended)
    .slice(0, topN);

  return {
    totalRecommendationPairs: recommendationDocs.length,
    totalRecommendedProducts: recommendationCounts.size,
    totalSourceProducts: sourceCounts.size,
    topRecommendedProducts,
    topSourceProducts,
  };
}

module.exports = {
  buildAnalyticsSummary,
};
