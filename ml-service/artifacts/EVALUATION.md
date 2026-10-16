# Evaluation: v1-f196f47d

Data source: **SIMULATED**. Simulated-data metrics are not evidence of real-user performance.

Reranking the same six actually shown in-stock same-category candidates. Not a whole-catalog or counterfactual policy evaluation.

| Engine | Precision@3 | Recall@3 | NDCG@3 |
|---|---:|---:|---:|
| Rules | 0.129756 | 0.291864 | 0.213192 |
| ML | 0.153077 | 0.345739 | 0.271443 |

1901 test requests; 1041 contain a positive label. All-negative requests score zero.
ML beats rules on test NDCG@3. Paired request-bootstrap 95% interval for delta: [0.04204207243081836, 0.07476229248392191].

Labels: ignored=0, click=1, cart=2, purchase=3 (max within 24h). Positive means label>0. P@3 divides by 3; R@3 divides by exposed positives; NDCG uses gain 2^label−1 and log2 rank discount. Macro-average over requests.

Chronological 60/20/20 request split; 24h label-maturity embargo at boundaries. No refit on test. Histories may include outcomes observed earlier in validation/test, matching online use. Two depths selected on validation only.

Randomized exposure gives reranking support, but click position bias remains. Unshown products have unknown relevance. The bootstrap resamples requests, not users; correlated repeat users can make this interval optimistic. Results apply to this simulator only.
