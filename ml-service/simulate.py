"""Seeded, honestly synthetic behavior. Hidden preferences are NEVER ranker features."""
import argparse
import hashlib
import json
import math
import random
from collections import Counter
from common import DATA, ARTIFACTS, timestamp, iso, write_json

CATALOG_SPEC = {
    "Dairy": (60, ["Amul", "Mother Dairy", "Nestle", "Aavin"], ["Toned Milk", "Full Cream Milk", "Low Fat Milk", "Organic Milk"]),
    "Detergent": (180, ["Tide", "Ariel", "Surf Excel", "Wheel"], ["Front Load", "Gentle Wash", "Liquid Detergent", "Laundry Powder"]),
    "Ice Cream": (160, ["Amul", "Havmor", "Kwality Walls", "Cream Bell"], ["Vanilla", "Chocolate", "Mango", "Strawberry"]),
    "Coffee": (240, ["Nescafe", "Bru", "Continental", "Tata Coffee"], ["Classic Instant", "Filter Blend", "Dark Roast", "Gold Blend"]),
    "Rice": (150, ["Daawat", "India Gate", "Kohinoor", "Fortune"], ["Basmati", "Brown Rice", "Everyday Rice", "Sona Masoori"]),
    "Snacks": (50, ["Haldiram", "Bikaji", "Lays", "Bingo"], ["Salted Mix", "Masala Crunch", "Classic Crisps", "Roasted Mix"]),
    "Shampoo": (220, ["Dove", "Pantene", "Clinic Plus", "Tresemme"], ["Daily Care", "Smooth Care", "Anti Dandruff", "Repair Care"]),
    "Tea": (190, ["Tata Tea", "Red Label", "Wagh Bakri", "Society"], ["Premium Leaf", "Strong Blend", "Green Tea", "Gold Tea"]),
}

def object_id(value):
    return hashlib.sha256(value.encode()).hexdigest()[:24]

def build_catalog(rng):
    products = []
    for category, (base, brands, variants) in CATALOG_SPEC.items():
        for b, brand in enumerate(brands):
            for v, variant in enumerate(variants):
                products.append({"_id": object_id(f"catalog:{category}:{b}:{v}"), "productName": f"{brand} {variant}",
                    "category": category, "brand": brand, "description": f"Packaged {category.lower()} for everyday household use. {variant}.",
                    "price": round(base * (0.55 + 0.48 * v) * rng.uniform(0.9, 1.1), 2),
                    "rating": round(rng.uniform(3.3, 4.9), 1), "availableQuantity": rng.choice([0, 12, 24, 48, 80]),
                    "createdAt": iso(timestamp("2026-01-01T00:00:00Z") + rng.randint(0, 90) * 86400), "source": "simulated"})
    return products

def baseline_score(source, candidate):
    similarity = max(0, 1 - abs(candidate["price"] - source["price"]) / max(source["price"], 1))
    if candidate["price"] < source["price"]:
        similarity = min(1, similarity + 0.1)
    return round(0.4 + 0.2 * similarity + 0.2 * max(0, min(1, candidate["rating"] / 5)) + 0.2 * (candidate["availableQuantity"] > 0), 3)

def generate(seed=42, users_count=240, sessions=40, output=DATA):
    rng = random.Random(seed)
    output.mkdir(parents=True, exist_ok=True)
    catalog = build_catalog(rng)
    categories = list(CATALOG_SPEC)
    users, schedule, events = [], [], []
    start = timestamp("2026-06-01T00:00:00Z")
    for i in range(users_count):
        user = {"_id": object_id(f"sim-user:{i}"), "source": "simulated",
            "categoryAffinity": {c: rng.gammavariate(1.3, 1) for c in categories},
            "preferredBrands": {c: rng.choice(CATALOG_SPEC[c][1]) for c in categories},
            "priceFactor": rng.uniform(0.6, 2.1), "priceSensitivity": rng.uniform(1.1, 3.5),
            "brandLoyalty": rng.uniform(0.5, 1.6), "ratingSensitivity": rng.uniform(0.2, 1.1)}
        users.append(user)
        for session in range(sessions):
            schedule.append((start + rng.uniform(0, 90 * 86400), i, session))
    for moment, user_index, session in sorted(schedule):
        user = users[user_index]
        category = rng.choices(categories, weights=list(user["categoryAffinity"].values()))[0]
        pool = [p for p in catalog if p["category"] == category]
        source = rng.choice(pool)
        eligible = [p for p in pool if p["_id"] != source["_id"] and p["availableQuantity"] > 0]
        candidates = rng.sample(eligible, min(6, len(eligible)))
        # Six genuinely shown products with uniformly random positions: exposure support
        # for reranking, while clicks still suffer from a position effect.
        rng.shuffle(candidates)
        request_id = f"sim-{user_index}-{session}"
        events.append({"userId": user["_id"], "eventType": "VIEW", "productId": source["_id"],
            "productSnapshot": source, "timestamp": iso(moment - 1), "source": "simulated"})
        for pos, product in enumerate(candidates, 1):
            impression_id = f"{request_id}-{pos}"
            base = {"userId": user["_id"], "productId": product["_id"], "sourceProductId": source["_id"],
                "recommendedProductId": product["_id"], "position": pos, "engine": "rules", "modelVersion": "rules-v1",
                "modelScore": baseline_score(source, product), "requestId": request_id, "impressionId": impression_id,
                "source": "simulated", "productSnapshot": product, "sourceSnapshot": source, "policy": "uniform-random-exposure"}
            events.append({**base, "eventType": "IMPRESSION", "timestamp": iso(moment)})
            budget = CATALOG_SPEC[category][0] * user["priceFactor"]
            fit = math.exp(-user["priceSensitivity"] * abs(math.log(product["price"] / budget)))
            loyal = product["brand"] == user["preferredBrands"][category]
            utility = (-3.4 + 2.15 * fit + 1.65 * user["brandLoyalty"] * loyal
                       + user["ratingSensitivity"] * (product["rating"] - 3.8)
                       + 0.25 * math.log1p(user["categoryAffinity"][category]) + rng.gauss(0, 0.45))
            click_probability = (1 / (1 + math.exp(-utility))) / math.log2(pos + 1)
            if rng.random() < click_probability:
                clicked = moment + rng.uniform(3, 60)
                events.append({**base, "eventType": "CLICK", "timestamp": iso(clicked)})
                if rng.random() < 0.18 + 0.23 * fit + 0.10 * loyal:
                    carted = clicked + rng.uniform(60, 900)
                    events.append({**base, "eventType": "CART", "timestamp": iso(carted)})
                    if rng.random() < 0.32 + 0.13 * fit:
                        events.append({**base, "eventType": "PURCHASE", "timestamp": iso(carted + rng.uniform(300, 7200))})
    events.sort(key=lambda e: (e["timestamp"], e.get("impressionId", ""), e["eventType"]))
    write_json(output / "catalog.json", catalog)
    write_json(output / "users.json", users)
    digest = hashlib.sha256()
    with (output / "events.jsonl").open("w") as stream:
        for event in events:
            line = json.dumps(event, sort_keys=True, separators=(",", ":")) + "\n"
            stream.write(line)
            digest.update(line.encode())
    counts = dict(Counter(e["eventType"] for e in events))
    summary = {"source": "simulated", "seed": seed, "users": users_count, "sessions_per_user": sessions,
        "products": len(catalog), "categories": len(categories), "brands": len(set(p["brand"] for p in catalog)),
        "event_counts": counts, "events": len(events), "requests": len(schedule), "events_sha256": digest.hexdigest(),
        "start": events[0]["timestamp"], "end": events[-1]["timestamp"], "exposure_policy": "uniform random six in-stock same-category alternatives",
        "click_through_rate": counts.get("CLICK", 0) / counts["IMPRESSION"],
        "cart_per_click": counts.get("CART", 0) / max(counts.get("CLICK", 0), 1),
        "purchase_per_cart": counts.get("PURCHASE", 0) / max(counts.get("CART", 0), 1)}
    write_json(output / "summary.json", summary)
    return summary

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--users", type=int, default=240)
    parser.add_argument("--sessions", type=int, default=40)
    args = parser.parse_args()
    print(json.dumps(generate(args.seed, args.users, args.sessions), indent=2))
