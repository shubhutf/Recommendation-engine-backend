require("dotenv").config();
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CATEGORIES = new Set(["Dairy", "Detergent", "Ice Cream"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateDate(value, fieldName) {
  assert(typeof value === "string", `${fieldName} must be a string`);
  assert(DATE_REGEX.test(value), `${fieldName} must be in YYYY-MM-DD format`);
  const date = new Date(value);
  assert(!Number.isNaN(date.getTime()), `${fieldName} must be a valid date`);
  assert(
    date.toISOString().startsWith(value),
    `${fieldName} must be a valid calendar date`
  );
}

function validateProduct(product) {
  assert(product.productName, "productName is required");
  assert(product.category, "category is required");
  assert(product.brand, "brand is required");
  assert(ALLOWED_CATEGORIES.has(product.category), `Invalid category: ${product.category}`);
  assert(Number.isFinite(product.price), "price must be a number");
  assert(product.price >= 0, "price cannot be negative");
  assert(Number.isFinite(product.rating), "rating must be a number");
  assert(product.rating >= 0 && product.rating <= 5, "rating must be between 0 and 5");
  assert(product.imageUrl, "imageUrl is required");
  validateDate(product.createdAt, "createdAt");
}

function validateInventoryItem(item) {
  assert(item.productId, "productId is required");
  assert(Number.isInteger(item.availableQuantity), "availableQuantity must be an integer");
  assert(item.availableQuantity >= 0, "availableQuantity cannot be negative");
  validateDate(item.updatedAt, "updatedAt");
}

function validateRecommendation(rec) {
  assert(rec.sourceProductId, "sourceProductId is required");
  assert(rec.recommendedProductId, "recommendedProductId is required");
  assert(
    String(rec.sourceProductId) !== String(rec.recommendedProductId),
    "sourceProductId and recommendedProductId must be different"
  );
  assert(
    Number.isInteger(rec.recommendationScore),
    "recommendationScore must be an integer"
  );
  assert(
    rec.recommendationScore >= 0 && rec.recommendationScore <= 100,
    "recommendationScore must be between 0 and 100"
  );
  assert(rec.reason, "reason is required");
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  const productsCollection = db.collection("products");
  const inventoryCollection = db.collection("inventory");
  const recommendationsCollection = db.collection("recommendations");

  await Promise.all([
    productsCollection.createIndex({ productName: 1, brand: 1 }, { unique: true }),
    inventoryCollection.createIndex({ productId: 1 }, { unique: true }),
    recommendationsCollection.createIndex(
      { sourceProductId: 1, recommendedProductId: 1 },
      { unique: true }
    ),
  ]);

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

  products.forEach(validateProduct);

  const inventoryQuantities = [25, 12, 30, 20, 16, 14, 18, 22, 10, 15, 19, 11];
  assert(
    inventoryQuantities.length === products.length,
    "inventory quantities must match product count"
  );

  const productIdByKey = new Map();

  for (const product of products) {
    const existingProduct = await productsCollection.findOne({
      productName: product.productName,
      brand: product.brand,
    });

    if (existingProduct) {
      await productsCollection.updateOne(
        { _id: existingProduct._id },
        { $set: product }
      );
      productIdByKey.set(`${product.productName}::${product.brand}`, existingProduct._id);
    } else {
      const result = await productsCollection.insertOne(product);
      productIdByKey.set(`${product.productName}::${product.brand}`, result.insertedId);
    }
  }

  const inventory = products.map((product, index) => ({
    productId: productIdByKey.get(`${product.productName}::${product.brand}`),
    availableQuantity: inventoryQuantities[index],
    updatedAt: "2026-07-07",
  }));

  inventory.forEach(validateInventoryItem);

  for (const item of inventory) {
    await inventoryCollection.updateOne(
      { productId: item.productId },
      { $set: item },
      { upsert: true }
    );
  }

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
      const recommendation = {
        sourceProductId: productIdByKey.get(
          `${sourceProduct.productName}::${sourceProduct.brand}`
        ),
        recommendedProductId: productIdByKey.get(
          `${rec.item.productName}::${rec.item.brand}`
        ),
        recommendationScore: Math.round(rec.score),
        reason: "Same category, ranked by brand, price, rating, and availability",
      };

      validateRecommendation(recommendation);
      recommendations.push(recommendation);
    }
  }

  for (const rec of recommendations) {
    await recommendationsCollection.updateOne(
      {
        sourceProductId: rec.sourceProductId,
        recommendedProductId: rec.recommendedProductId,
      },
      { $set: rec },
      { upsert: true }
    );
  }

  console.log("Seed completed successfully");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
