"""Internal scoring service. Browser traffic goes through the authenticated Node API."""
import hashlib
import hmac
import os
from contextlib import asynccontextmanager
from typing import Any
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from common import ARTIFACTS, FEATURES, MODEL_NAME, MODEL_REVISION, read_json
from embeddings import Embeddings
from features import features_for

runtime = {}

@asynccontextmanager
async def lifespan(app):
    if os.environ.get("ENVIRONMENT") == "production" and not os.environ.get("ML_SERVICE_TOKEN"):
        raise RuntimeError("ML_SERVICE_TOKEN is required in production")
    metadata = read_json(ARTIFACTS / "metadata.json")
    if metadata["features"] != FEATURES or metadata["embedding_revision"] != MODEL_REVISION:
        raise RuntimeError("Model feature/embedding schema mismatch")
    if hashlib.sha256((ARTIFACTS / "ranker.ubj").read_bytes()).hexdigest() != metadata["model_sha256"]:
        raise RuntimeError("Model checksum mismatch")
    model = xgb.XGBRanker()
    model.load_model(ARTIFACTS / "ranker.ubj")
    cache = Embeddings(allow_encode=True)
    from sentence_transformers import SentenceTransformer
    cache.model = SentenceTransformer(MODEL_NAME, revision=MODEL_REVISION, device="cpu", local_files_only=os.getenv("HF_HUB_OFFLINE") == "1")
    runtime.update(model=model, embeddings=cache, metadata=metadata)
    yield
    runtime.clear()

app = FastAPI(title="Restock internal ranker", lifespan=lifespan)

class ScoreRequest(BaseModel):
    source: dict[str, Any]
    candidates: list[dict[str, Any]] = Field(min_length=1, max_length=200)
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    globalStats: dict[str, dict[str, float]] = Field(default_factory=dict)
    asOf: str

@app.get("/health")
def health():
    return {"ready": bool(runtime), "modelVersion": runtime.get("metadata", {}).get("version")}

@app.post("/score")
def score(body: ScoreRequest, x_ml_token: str = Header(default="")):
    configured = os.environ.get("ML_SERVICE_TOKEN", "")
    if configured and not hmac.compare_digest(x_ml_token, configured):
        raise HTTPException(401, "Invalid service token")
    if not runtime:
        raise HTTPException(503, "Model not ready")
    if len({str(p.get("_id")) for p in body.candidates}) != len(body.candidates):
        raise HTTPException(422, "Duplicate candidates")
    if any(p.get("category") != body.source.get("category") or p.get("availableQuantity", 0) <= 0 or p.get("_id") == body.source.get("_id") for p in body.candidates):
        raise HTTPException(422, "Candidate violates category/stock/self filter")
    try:
        runtime["embeddings"].ensure([body.source, *body.candidates])
        rows = [features_for(body.source, candidate, body.asOf, body.history, body.globalStats, runtime["embeddings"]) for candidate in body.candidates]
        predictions = runtime["model"].predict(pd.DataFrame(rows)[FEATURES])
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(422, "Invalid product/history snapshot") from error
    return {"modelVersion": runtime["metadata"]["version"], "trainingSource": runtime["metadata"]["training_source"],
        "scores": [{"productId": str(product["_id"]), "score": float(value)} for product, value in zip(body.candidates, predictions)]}
