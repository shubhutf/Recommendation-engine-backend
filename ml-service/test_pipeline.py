from collections import defaultdict
import numpy as np
import pandas as pd
import pytest
from common import DATA, FEATURES, read_json, timestamp, iso
from dataset import build_examples, chronological_split
from embeddings import Embeddings, text_key
from evaluate import metrics_at_k
from features import HistoryState, features_for
from simulate import generate, baseline_score

def test_simulator_is_reproducible_and_funnel_is_ordered(tmp_path):
    first = generate(11, 8, 8, tmp_path / "first")
    second = generate(11, 8, 8, tmp_path / "second")
    assert first == second
    import json
    events = [json.loads(line) for line in (tmp_path / "first/events.jsonl").read_text().splitlines()]
    by_exposure = defaultdict(dict)
    for event in events:
        assert event["source"] == "simulated"
        if event.get("impressionId"):
            by_exposure[event["impressionId"]][event["eventType"]] = timestamp(event["timestamp"])
    for funnel in by_exposure.values():
        if "PURCHASE" in funnel:
            assert funnel["IMPRESSION"] < funnel["CLICK"] < funnel["CART"] < funnel["PURCHASE"]
        if "CART" in funnel:
            assert "CLICK" in funnel

def test_real_embeddings_have_dimensions_norm_and_content_invalidation():
    cache = Embeddings()
    product = read_json(DATA / "catalog.json")[0]
    assert len(cache.vectors[text_key(product)]) == 384
    assert np.linalg.norm(cache.vectors[text_key(product)]) == pytest.approx(1, abs=1e-6)
    assert cache.cosine(product, product) == pytest.approx(1, abs=1e-6)
    assert text_key({**product, "productName": "Changed name"}) != text_key(product)
    assert text_key({**product, "price": 100}) == text_key(product)

def test_features_ignore_future_and_same_timestamp_outcomes():
    catalog = read_json(DATA / "catalog.json")
    source, candidate = catalog[:2]
    now = timestamp("2026-08-01T00:00:00Z")
    cache = Embeddings()
    base = features_for(source, candidate, now, [], {}, cache)
    future = [{"eventType": "PURCHASE", "timestamp": iso(now + offset), "productSnapshot": candidate} for offset in [0, 1, 1000]]
    assert features_for(source, candidate, now, future, {}, cache) == base
    past = [{"eventType": "CLICK", "timestamp": iso(now - 1), "productSnapshot": candidate}]
    assert features_for(source, candidate, now, past, {}, cache)["user_brand_affinity"] == 1
    assert set(base) == set(FEATURES)
    assert not set(["preferredBrands", "priceSensitivity", "position", "label"]) & set(base)

def test_labels_use_only_shown_outcomes_and_matured_window():
    catalog = read_json(DATA / "catalog.json")
    source, candidate, unshown = catalog[:3]
    candidate = {**candidate, "availableQuantity": 5}
    moment = timestamp("2026-08-01T00:00:00Z")
    base = {"source": "simulated", "userId": "u", "requestId": "q", "impressionId": "shown", "position": 1,
        "productId": candidate["_id"], "productSnapshot": candidate, "sourceSnapshot": source}
    events = [{**base, "eventType": "IMPRESSION", "timestamp": iso(moment)},
        {**base, "eventType": "CLICK", "timestamp": iso(moment + 1)},
        {**base, "eventType": "PURCHASE", "timestamp": iso(moment + 90000)},
        {**base, "eventType": "PURCHASE", "impressionId": "never-shown", "productId": unshown["_id"], "timestamp": iso(moment + 2)}]
    frame = build_examples(events, Embeddings())
    assert len(frame) == 1
    assert frame.iloc[0].label == 1  # purchase after 24h is not this exposure's label
    assert frame.iloc[0].user_brand_affinity == 0

def test_metrics_known_example_and_zero_positive_policy():
    good = metrics_at_k([3, 2, 1, 0], [4, 3, 2, 1])
    assert good == {"precision_at_3": 1, "recall_at_3": 1, "ndcg_at_3": 1}
    assert metrics_at_k([0, 0, 0], [1, 2, 3]) == {"precision_at_3": 0, "recall_at_3": 0, "ndcg_at_3": 0}
    assert metrics_at_k([3, 2, 1, 0], [1, 2, 3, 4])["ndcg_at_3"] < 1

def test_chronological_split_embargo():
    frame = pd.DataFrame({"requestId": [f"q{i}" for i in range(100)], "timestamp": np.arange(100) * 86400 + 100000,
        "labelMaturedAt": np.arange(100) * 86400 + 186400})
    train, validation, test, split = chronological_split(frame)
    assert train.labelMaturedAt.max() < validation.timestamp.min()
    assert validation.labelMaturedAt.max() < test.timestamp.min()
    assert split["embargo_hours"] == 24

def test_history_statistics_have_strict_time_windows():
    state = HistoryState()
    now = timestamp("2026-08-01T00:00:00Z")
    for days, kind in [(1, "CLICK"), (8, "CART"), (15, "PURCHASE"), (0, "PURCHASE")]:
        state.observe({"eventType": kind, "productId": "p", "userId": "u", "timestamp": iso(now - days * 86400)})
    assert state.stats(["p"], now)["p"] == {"recent": 1, "previous": 2}

def test_service_scores_actual_model_and_rejects_business_filter():
    from fastapi.testclient import TestClient
    from app import app
    catalog = read_json(DATA / "catalog.json")
    source = catalog[0]
    candidates = [p for p in catalog[1:16] if p["availableQuantity"] > 0][:3]
    body = {"source": source, "candidates": candidates, "asOf": "2026-08-01T00:00:00Z", "history": [], "globalStats": {}}
    with TestClient(app) as client:
        assert client.get("/health").json()["ready"]
        result = client.post("/score", json=body)
        assert result.status_code == 200, result.text
        assert len(result.json()["scores"]) == 3
        assert all(np.isfinite(row["score"]) for row in result.json()["scores"])
        body["candidates"][0] = {**candidates[0], "availableQuantity": 0}
        assert client.post("/score", json=body).status_code == 422
