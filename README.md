# Recommendation Engine — Backend

Node.js/Express + MongoDB backend powering the [Smart Substitution and Product Recommendation Engine](https://github.com/shubhutf/Recommendation-engine-Frontend). Handles product/inventory management, the recommendation scoring engine, and AI-generated explanations via Google Gemini.

**Frontend repo:** https://github.com/shubhutf/Recommendation-engine-Frontend
**Live API:** deployed on Render

---

## Tech Stack

- Node.js + Express
- MongoDB Atlas (Mongoose)
- Google Gemini API (`gemini-flash-latest`) — AI explanation generation
- Joi — request validation
- Helmet, CORS, Morgan — security & logging

---

## Setup

```bash
git clone https://github.com/shubhutf/Recommendation-engine-backend.git
cd Recommendation-engine-backend
npm install
```

Create a `.env` file in the project root:
```
MONGODB_URI=your_mongodb_connection_string
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
```

```bash
npm run dev      # start with nodemon (auto-restart on changes)
npm start        # start normally
npm run seed     # populate the database with sample data
```

---

## API Reference

### Products
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/products` | List products (supports `category`, `brand`, `limit` query params) |
| POST | `/api/v1/products` | Create a product |
| PUT | `/api/v1/products/:id` | Update a product |
| DELETE | `/api/v1/products/:id` | Delete a product |

### Inventory
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/inventory` | List all inventory records (populated with product details) |
| POST | `/api/v1/inventory` | Create an inventory record |
| PUT | `/api/v1/inventory/:id` | Update stock quantity |

### Recommendations
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/recommendations/:productId` | Returns top 3 ranked substitutes with score, breakdown, and AI-generated explanation |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/analytics/summary` | Real usage stats: most recommended products, most-searched-for products, total recommendation pairs |

### Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Returns `{ success: true, message: "Server is running" }` |

---

## Recommendation Scoring

```
Match Score = 0.4 × Category Match (1 if same category, else excluded)
            + 0.2 × Price Similarity (closer price = higher score, cheaper gets a small bonus)
            + 0.2 × Rating (normalized 0–5 → 0–1)
            + 0.2 × Inventory Availability (1 if in stock, else 0)
```

In-stock products always rank above out-of-stock ones, regardless of score. Only products in the same category as the source product are considered.

## AI Explanation Module

`aiExplanationService.js` calls Gemini with the source product, recommended product, and score breakdown, asking for a one-sentence, factual explanation. If the Gemini call fails for any reason (missing key, rate limit, network error), it falls back to a deterministic template built from the same breakdown data — so the endpoint never fails even if the AI service is unavailable.

Every recommendation request is logged to the `recommendations` collection, which powers the Analytics endpoint.

---

## Database Design

**Products collection:** `productName`, `category`, `brand`, `price`, `rating`, `imageUrl`, `createdAt`

**Inventory collection:** `productId` (ref → Product), `availableQuantity`, `updatedAt`

**Recommendations collection** (usage log): `sourceProductId`, `recommendedProductId`, `recommendationScore`, `reason`, `createdAt`

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PORT` | Server port (defaults to 5000) |
| `GEMINI_API_KEY` | Google Gemini API key ([get one free](https://aistudio.google.com/apikey)) — optional, service falls back gracefully if unset |
