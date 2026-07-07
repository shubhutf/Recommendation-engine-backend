const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;

  const products = [
    {
      productName: "Amul 500ml milk",
      category: "Dairy",
      brand: "Amul",
      price: 50,
      rating: 4.5,
      imageUrl:
        "https://www.bbassets.com/media/uploads/p/l/40041431_1-amul-taaza-fresh-toned-milk.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Nestle 1L Milk",
      category: "Dairy",
      brand: "Nestle",
      price: 58,
      rating: 4.2,
      imageUrl:
        "https://www.bbassets.com/media/uploads/p/l/100011680_12-nestle-a-nourish-toned-milk.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Mother Dairy 500ml Milk",
      category: "Dairy",
      brand: "Mother Dairy",
      price: 48,
      rating: 4.4,
      imageUrl:
        "https://www.bbassets.com/media/uploads/p/l/40147029_5-mother-dairy-toned-milk.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Aavin 500ml Milk",
      category: "Dairy",
      brand: "Aavin",
      price: 46,
      rating: 4.1,
      imageUrl:
        "https://www.bbassets.com/media/uploads/p/l/40151384_1-aavin-pasteurised-full-cream-milk.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Tide 1kg Detergent",
      category: "Detergent",
      brand: "Tide",
      price: 120,
      rating: 4.6,
      imageUrl:
        "https://rukminim2.flixcart.com/image/894/894/ktszgy80/washing-powder/v/u/t/1-jasmine-rose-1kg-tide-original-imag72j87zyvghrv.jpeg?q=90",
      createdAt: "2026-07-07",
    },
    {
      productName: "Ariel 1kg Detergent",
      category: "Detergent",
      brand: "Ariel",
      price: 115,
      rating: 4.5,
      imageUrl:
        "https://m.media-amazon.com/images/I/41HLWHD2ypL._SY300_SX300_QL70_FMwebp_.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Surf Excel 1kg Detergent",
      category: "Detergent",
      brand: "Surf Excel",
      price: 125,
      rating: 4.7,
      imageUrl:
        "https://m.media-amazon.com/images/I/61m1Pn9lzHL._SL1000_.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Wheel 1kg Detergent",
      category: "Detergent",
      brand: "Wheel",
      price: 95,
      rating: 4.1,
      imageUrl:
        "https://m.media-amazon.com/images/I/51OQdxHYtyL._SY300_SX300_QL70_FMwebp_.jpg",
      createdAt: "2026-07-07",
    },
    {
      productName: "Amul Vanilla Ice Cream",
      category: "Ice Cream",
      brand: "Amul",
      price: 70,
      rating: 4.4,
      imageUrl: "/images/amul-vanilla-ice-cream.png",
      createdAt: "2026-07-07",
    },
    {
      productName: "Kwality Walls Chocolate Ice Cream",
      category: "Ice Cream",
      brand: "Kwality Walls",
      price: 75,
      rating: 4.5,
      imageUrl: "/images/kwality-walls-chocolate-ice-cream.png",
      createdAt: "2026-07-07",
    },
    {
      productName: "Havmor Strawberry Ice Cream",
      category: "Ice Cream",
      brand: "Havmor",
      price: 68,
      rating: 4.3,
      imageUrl: "/images/havmor-strawberry-ice-cream.png",
      createdAt: "2026-07-07",
    },
    {
      productName: "Movenpick Butterscotch Ice Cream",
      category: "Ice Cream",
      brand: "Movenpick",
      price: 90,
      rating: 4.6,
      imageUrl: "/images/movenpick-butterscotch-ice-cream.png",
      createdAt: "2026-07-07",
    },
  ];

  const insertedProducts = await db.collection("products").insertMany(products);
  const productIds = Object.values(insertedProducts.insertedIds);

  const inventory = productIds.map((productId, index) => ({
    productId,
    availableQuantity: [25, 12, 30, 20, 16, 14, 18, 22, 10, 15, 19, 11][index],
    updatedAt: "2026-07-07",
  }));

  await db.collection("inventory").insertMany(inventory);

  const recommendations = [];
  for (const sourceProduct of products) {
    const sourceIndex = products.findIndex(
      (item) =>
        item.productName === sourceProduct.productName &&
        item.brand === sourceProduct.brand
    );
    const sameCategory = products.filter(
      (item) =>
        item.category === sourceProduct.category &&
        item.productName !== sourceProduct.productName
    );

    const ranked = sameCategory
      .map((item) => {
        let score = 0;
        if (item.brand === sourceProduct.brand) score += 20;
        score += Math.max(0, 20 - Math.abs(item.price - sourceProduct.price));
        score += item.rating * 10;
        score += 10;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const rec of ranked) {
      recommendations.push({
        sourceProductId: productIds[sourceIndex],
        recommendedProductId: productIds[products.indexOf(rec.item)],
        recommendationScore: Math.round(rec.score),
        reason: "Same category, ranked by brand, price, rating, and availability",
      });
    }
  }

  await db.collection("recommendations").insertMany(recommendations);

  console.log("Seed completed successfully");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
