"""Metric definitions are explicit; no unexposed item is treated as negative."""
import numpy as np

def metrics_at_k(labels, scores, k=3, ids=None):
    labels, scores = np.asarray(labels), np.asarray(scores)
    ids = np.asarray(ids if ids is not None else np.arange(len(labels)).astype(str))
    order = np.lexsort((ids, -scores))[:k]
    ranked = labels[order]
    positive = int((labels > 0).sum())
    precision = float((ranked > 0).sum() / k)
    recall = float((ranked > 0).sum() / positive) if positive else 0.0
    discounts = np.log2(np.arange(2, len(ranked) + 2))
    dcg = float(((2.0 ** ranked - 1) / discounts).sum())
    ideal = np.sort(labels)[::-1][:k]
    idcg = float(((2.0 ** ideal - 1) / np.log2(np.arange(2, len(ideal) + 2))).sum())
    return {"precision_at_3": precision, "recall_at_3": recall, "ndcg_at_3": dcg / idcg if idcg else 0.0}

def evaluate(frame, predictions):
    evaluated = frame.copy()
    evaluated["prediction"] = predictions
    results = {"rules": [], "ml": []}
    positive = 0
    for _, group in evaluated.groupby("requestId", sort=False):
        positive += int((group.label > 0).any())
        for engine, column in [("rules", "baselineScore"), ("ml", "prediction")]:
            results[engine].append(metrics_at_k(group.label.to_numpy(), group[column].to_numpy(), ids=group.productId.to_numpy()))
    means = {engine: {key: float(np.mean([r[key] for r in rows])) for key in rows[0]} for engine, rows in results.items()}
    rng = np.random.default_rng(42)
    difference = np.array([m["ndcg_at_3"] - b["ndcg_at_3"] for b, m in zip(results["rules"], results["ml"])])
    bootstrap = np.array([difference[rng.integers(0, len(difference), len(difference))].mean() for _ in range(500)])
    return {**means, "requests": len(difference), "requests_with_positive": positive,
        "ndcg_delta_95pct_bootstrap_ci": np.quantile(bootstrap, [0.025, 0.975]).tolist(),
        "all_negative_policy": "zero for all three metrics; all requests included", "k": 3}
