"""Real pretrained MiniLM embeddings; missing vectors never become fabricated vectors."""
import hashlib
import json
import os
import threading
import numpy as np
from common import ROOT, ARTIFACTS, MODEL_NAME, MODEL_REVISION, read_json, write_json

os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))

def product_text(product):
    return " | ".join(str(product.get(key, "") or "").strip() for key in ("productName", "category", "brand", "description"))

def text_key(product):
    return hashlib.sha256((MODEL_REVISION + "\n" + product_text(product)).encode()).hexdigest()

class Embeddings:
    def __init__(self, path=ARTIFACTS / "embeddings.json", allow_encode=False):
        self.path = path
        self.allow_encode = allow_encode
        self.model = None
        self.lock = threading.RLock()
        cache = read_json(path) if path.exists() else {}
        if cache and cache.get("revision") != MODEL_REVISION:
            raise ValueError("Embedding cache revision mismatch")
        self.vectors = cache.get("vectors", {})

    def ensure(self, products):
        with self.lock:
            missing = {text_key(p): product_text(p) for p in products if text_key(p) not in self.vectors}
            if not missing:
                return
            if not self.allow_encode:
                raise ValueError("Product embedding missing; refresh the cache")
            if self.model is None:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(MODEL_NAME, revision=MODEL_REVISION, device="cpu")
            vectors = self.model.encode(list(missing.values()), normalize_embeddings=True, show_progress_bar=True)
            self.vectors.update({key: vector.astype(float).round(8).tolist() for key, vector in zip(missing, vectors)})
            write_json(self.path, {"model": MODEL_NAME, "revision": MODEL_REVISION, "dimensions": 384, "vectors": self.vectors})

    def cosine(self, a, b):
        return float(np.clip(np.dot(self.vectors[text_key(a)], self.vectors[text_key(b)]), -1, 1))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default=str(ROOT / "data" / "catalog.json"))
    args = parser.parse_args()
    cache = Embeddings(allow_encode=True)
    cache.ensure(read_json(args.catalog))
    print(json.dumps({"cached_vectors": len(cache.vectors), "dimensions": 384, "revision": MODEL_REVISION}))
