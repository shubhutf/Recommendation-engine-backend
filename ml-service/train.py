"""Train, select using validation ONLY, evaluate test once, and write real artifacts."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from datetime import datetime, timezone
os.environ.setdefault("MPLCONFIGDIR", str(__import__("pathlib").Path(__file__).parent / ".cache" / "matplotlib"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb
from common import ARTIFACTS, DATA, FEATURES, MODEL_NAME, MODEL_REVISION, read_events, read_json, write_json
from dataset import build_examples, chronological_split
from embeddings import Embeddings
from evaluate import evaluate

def ordered(frame):
    result = frame.sort_values(["timestamp", "requestId", "productId"]).copy()
    sizes = result.groupby("requestId", sort=False).size().to_numpy()
    # Sort by request order; each query must be contiguous for LambdaMART.
    assert result.requestId.ne(result.requestId.shift()).sum() == len(sizes)
    return result, sizes

def main(events_path=DATA / "events.jsonl", source="simulated"):
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    events = [event for event in read_events(events_path) if event["source"] == source and event.get("userId")]
    embeddings = Embeddings(allow_encode=True)
    embeddings.ensure([e[key] for e in events if e["source"] == source for key in ["productSnapshot", "sourceSnapshot"] if key in e])
    frame = build_examples(events, embeddings, source)
    frame.to_csv(DATA / "examples.csv", index=False)
    train, validation, test, split = chronological_split(frame)
    train, train_groups = ordered(train)
    validation, validation_groups = ordered(validation)
    test, _ = ordered(test)
    selection = []
    best = None
    for depth in [3, 5]:
        model = xgb.XGBRanker(objective="rank:ndcg", tree_method="hist", n_estimators=220, max_depth=depth,
            learning_rate=0.05, subsample=0.9, colsample_bytree=0.9, reg_lambda=3,
            min_child_weight=8, random_state=42, n_jobs=2, eval_metric="ndcg@3", early_stopping_rounds=25)
        model.fit(train[FEATURES], train.label, group=train_groups,
            eval_set=[(validation[FEATURES], validation.label)], eval_group=[validation_groups], verbose=False)
        metrics = evaluate(validation, model.predict(validation[FEATURES]))
        selection.append({"max_depth": depth, "best_iteration": int(model.best_iteration), "validation_ndcg_at_3": metrics["ml"]["ndcg_at_3"]})
        if best is None or selection[-1]["validation_ndcg_at_3"] > best[0]:
            best = (selection[-1]["validation_ndcg_at_3"], model)
    model = best[1]
    results = evaluate(test, model.predict(test[FEATURES]))
    model.save_model(ARTIFACTS / "ranker.ubj")
    artifact_hash = hashlib.sha256((ARTIFACTS / "ranker.ubj").read_bytes()).hexdigest()
    importance = [{"feature": name, "importance": float(value)} for name, value in zip(FEATURES, model.feature_importances_)]
    importance.sort(key=lambda row: row["importance"], reverse=True)
    summary = read_json(DATA / "summary.json") if source == "simulated" else {
        "source": "real", "events": len(events), "users": frame.userId.nunique(), "requests": frame.requestId.nunique(),
        "products": frame.productId.nunique()}
    metadata = {"version": f"v1-{artifact_hash[:8]}", "trained_at": datetime.now(timezone.utc).isoformat(),
        "training_source": source, "dataset": summary, "features": FEATURES, "feature_schema": "v1", "feature_importance": importance,
        "embedding_model": MODEL_NAME, "embedding_revision": MODEL_REVISION, "model_sha256": artifact_hash,
        "objective": "rank:ndcg", "score_semantics": "uncalibrated ranking margin; not a probability or percentage",
        "model_selection": selection, "best_iteration": int(model.best_iteration), "split": split, "metrics": results,
        "minimum_history": 5, "packages": {name: importlib.metadata.version(name) for name in ["xgboost", "numpy", "pandas", "sentence-transformers"]}}
    report = {"source": source, "model_version": metadata["version"], "metrics": results, "split": split,
        "scope": "Reranking the same six actually shown in-stock same-category candidates. Not a whole-catalog or counterfactual policy evaluation.",
        "limitation": "Simulated-data metrics are not evidence of real-user performance." if source == "simulated" else "Observed-policy evaluation has exposure and position bias."}
    write_json(ARTIFACTS / "metadata.json", metadata)
    write_json(ARTIFACTS / "evaluation.json", report)
    rows = [f"| {engine} | {m['precision_at_3']:.6f} | {m['recall_at_3']:.6f} | {m['ndcg_at_3']:.6f} |" for engine, m in [("Rules", results["rules"]), ("ML", results["ml"])]]
    improved = results["ml"]["ndcg_at_3"] > results["rules"]["ndcg_at_3"]
    (ARTIFACTS / "EVALUATION.md").write_text(
        f"# Evaluation: {metadata['version']}\n\nData source: **{source.upper()}**. {report['limitation']}\n\n"
        + report["scope"] + "\n\n| Engine | Precision@3 | Recall@3 | NDCG@3 |\n|---|---:|---:|---:|\n" + "\n".join(rows)
        + f"\n\n{results['requests']} test requests; {results['requests_with_positive']} contain a positive label. All-negative requests score zero.\n"
        + f"ML {'beats' if improved else 'does not beat'} rules on test NDCG@3. Paired request-bootstrap 95% interval for delta: {results['ndcg_delta_95pct_bootstrap_ci']}.\n"
        + "\nLabels: ignored=0, click=1, cart=2, purchase=3 (max within 24h). Positive means label>0. P@3 divides by 3; R@3 divides by exposed positives; NDCG uses gain 2^label−1 and log2 rank discount. Macro-average over requests.\n"
        + "\nChronological 60/20/20 request split; 24h label-maturity embargo at boundaries. No refit on test. Histories may include outcomes observed earlier in validation/test, matching online use. Two depths selected on validation only.\n"
        + "\nRandomized exposure gives reranking support, but click position bias remains. Unshown products have unknown relevance. The bootstrap resamples requests, not users; correlated repeat users can make this interval optimistic. Results apply to this simulator only.\n")
    (ARTIFACTS / "MODEL_CARD.md").write_text(
        f"# Model card: {metadata['version']}\n\nXGBoost LambdaMART (`rank:ndcg`); grouped requests, graded funnel relevance. Scores are ranking margins, never probabilities.\n\n"
        + f"Trained {metadata['trained_at']}; source **{source}**; SHA256 {artifact_hash}.\n\n"
        + "Purpose: rerank same-category in-stock grocery substitutions for users with at least five positive interactions. Rule-based cold start and outage fallback remain mandatory.\n\n"
        + "MiniLM cosine is one of 13 features. Product snapshots and strictly earlier observed history prevent future-data leakage. Hidden simulator preferences and display position are excluded. Candidate category/stock features are constant after filtering; this is expected.\n\n"
        + "See metadata.json for exact features, package versions, splits, hyperparameter selection, gain importance and metrics. Importance is predictive association, not causal attribution.\n\n"
        + "Limitations: simulated users, prices and stock; static inventory; limited catalog; observed exposure labels; position bias; repeated users; no real-user validation, online A/B test or causal lift claim. Do not use offline results as deployment approval.\n")
    # EDA uses actual examples; plots are saved, never transcribed by hand.
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    frame.label.value_counts().reindex([0, 1, 2, 3], fill_value=0).plot.bar(ax=axes[0], color="#8FCB1F", title=f"{source.title()} exposed labels")
    frame.groupby("position").label.apply(lambda labels: (labels > 0).mean()).plot.bar(ax=axes[1], color="#12201A", title="Positive rate by shown position")
    axes[1].set_ylabel("fraction")
    axes[2].barh([r["feature"] for r in importance][::-1], [r["importance"] for r in importance][::-1], color="#8FCB1F")
    axes[2].set_title("Normalized split gain")
    fig.tight_layout()
    fig.savefig(ARTIFACTS / "eda.png", dpi=150)
    plt.close(fig)
    write_json(ARTIFACTS / "eda.json", {"source": source, "label_counts": {str(k): int(v) for k, v in frame.label.value_counts().items()},
        "missing_features": frame[FEATURES].isna().sum().to_dict(), "constant_features": [key for key in FEATURES if frame[key].nunique() == 1]})
    print(json.dumps({"version": metadata["version"], "metrics": results, "split": split}, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--events", default=str(DATA / "events.jsonl"))
    parser.add_argument("--source", choices=["simulated", "real"], default="simulated")
    args = parser.parse_args()
    main(args.events, args.source)
