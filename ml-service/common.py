"""Paths, schemas and time helpers shared by offline and online code."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ARTIFACTS = ROOT / "artifacts"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
FEATURES = ["category_match", "embedding_cosine", "price_diff", "price_ratio", "candidate_rating",
            "popularity", "in_stock", "brand_match", "user_category_affinity", "user_brand_affinity",
            "user_price_fit", "recency_days", "trend_velocity"]
WEIGHTS = {"CLICK": 1, "CART": 2, "PURCHASE": 3}
LABEL_WINDOW_HOURS = 24

def timestamp(value):
    if isinstance(value, (int, float)):
        return float(value)
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()

def iso(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")

def read_json(path):
    return json.loads(Path(path).read_text())

def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n")

def read_events(path):
    with Path(path).open() as stream:
        for line in stream:
            if line.strip():
                yield json.loads(line)
