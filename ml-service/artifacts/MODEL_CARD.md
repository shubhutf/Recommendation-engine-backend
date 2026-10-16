# Model card: v1-f196f47d

XGBoost LambdaMART (`rank:ndcg`); grouped requests, graded funnel relevance. Scores are ranking margins, never probabilities.

Trained 2026-10-16T16:22:17.538594+00:00; source **simulated**; SHA256 f196f47d8a19a4d9376aeb1f61971240328379ea11e50c141458fb48464a164c.

Purpose: rerank same-category in-stock grocery substitutions for users with at least five positive interactions. Rule-based cold start and outage fallback remain mandatory.

MiniLM cosine is one of 13 features. Product snapshots and strictly earlier observed history prevent future-data leakage. Hidden simulator preferences and display position are excluded. Candidate category/stock features are constant after filtering; this is expected.

See metadata.json for exact features, package versions, splits, hyperparameter selection, gain importance and metrics. Importance is predictive association, not causal attribution.

Limitations: simulated users, prices and stock; static inventory; limited catalog; observed exposure labels; position bias; repeated users; no real-user validation, online A/B test or causal lift claim. Do not use offline results as deployment approval.
