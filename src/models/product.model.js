const mongoose = require("mongoose");

// --- PRODUCT SCHEMA DEFINITION ---
// Product model ki structure yahan define ho rahi hai.
const ProductSchema = new mongoose.Schema(
  {
    // Product ka naam
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    // Product kis category ka hai
    category: {
  type: String,
  required: [true, "Category is required"],
  trim: true,
},

    // Product ka brand
   brand: {
  type: String,
  required: [true, "Brand is required"],
  trim: true,
},
// Product ka pack size / quantity
// Example: 500ml, 1L, 2kg, 250g
size: {
  type: String,
  required: [false, "Product size is required"],
  trim: true,
},

imageUrl: {
  type: String,
  trim: true,
},


    // Product ki selling price
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    // Product ki average customer rating
    rating: {
      type: Number,
      required: [true, "Product rating is required"],
      min: [0, "Rating cannot be less than 0"],
      max: [5, "Rating cannot be greater than 5"],
      default: 0,
    },
  },
  {
    // createdAt aur updatedAt automatically maintain honge.
    timestamps: true,
  }
);

// --- PRODUCTION-READY INDEXES ---

// Same category ke products ko jaldi retrieve karega.
ProductSchema.index({ category: 1 });

// Same brand ke products search karne ke liye.
ProductSchema.index({ brand: 1 });

// Recommendation engine category + price ke basis par filtering karega.
ProductSchema.index({ category: 1, price: 1 });

// Same category me highly-rated products ko efficiently retrieve karega.
ProductSchema.index({ category: 1, rating: -1 });
// Same category aur same size ke products jaldi retrieve honge.
ProductSchema.index({ category: 1, size: 1 });

// --- MODEL EXPORT ---
// Schema ko Product model me compile karke export kar rahe hain.
const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;