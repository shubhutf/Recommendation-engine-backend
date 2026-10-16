# Phase plan, delivered work and exact checks

The owner authorized autonomous completion. Both repos use `feature/personalized-ml-ranking` from `origin/develop`. The initial implementation was verified locally; subsequent authorized browser publishing and deployment are recorded in [RELEASE](RELEASE.md). Commands below are PowerShell, run from the backend root unless stated otherwise; setup is in README.

## 0 — Auth

Plan: salted scrypt passwords, HS256 JWT expiry/issuer/audience, customer-only registration, admin CLI and server-side guards; frontend session and role routes.

Delivered: both roles, protected product/inventory writes, Login/Register/logout, session token handling, `/auth/me`, customer navigation and protected Inventory route. Login/register ignore stale bearer tokens. Admins are provisioned only from a trusted CLI/environment.

```powershell
node --test .\test\auth.test.js
# Full integration coverage (recommended):
npm test
# From frontend root:
npm run lint
npm run build
```

Hinglish: “JWT se user identify hota hai; role check server karta hai, sirf button hide karna security nahi hai.”

## 1 — Interaction events

Plan: validated owned exposures/outcomes, idempotency, immutable snapshots, bounded background impression + legacy logging, isolated analytics.

Delivered: real user IDs, all six event types, source provenance, timestamp, position, score/version/engine; feedback and click UI; bounded non-blocking impression queue and acknowledged outcome writes. Legacy recommendations remain supported. Product deletion cleans inventory/legacy links, while events retain historical snapshots.

```powershell
npm test
npm run dev:local
# In a different terminal once all three demo services are running:
npm run smoke:local
```

Hinglish: “Impression matlab kya dikhaya; click/cart/purchase batata hai user ne kya kiya. Training ke liye dono chahiye.”

## 2 — Embeddings

Plan: frozen all-MiniLM-L6-v2 embeddings keyed by text and model revision; cosine as one feature.

Delivered: real normalized 384-dimensional pretrained vectors, a committed cache, content-hash invalidation and cache reuse for serving. New text uses the same pinned encoder; no synthetic-vector fallback.

```powershell
.\.venv\Scripts\python.exe .\ml-service\embeddings.py
.\.venv\Scripts\python.exe -m pytest .\ml-service -q -k embeddings
```

Hinglish: “Embedding meaning ka vector hai; cosine ek input feature hai, final recommendation score nahi.”

## 3 — Honest simulated data

Plan: reproducible hidden preferences, noise, randomized exposures, position bias, ordered funnel and spread-out timestamps, expanded isolated catalog.

Delivered: seed-42 generator, 128 products, 240 users and 77,890 events; all simulated rows labeled. Actual counts/checksum and assumptions live in `data/summary.json` and `docs/DATA.md`. No simulated events are loaded into production Mongo.

```powershell
.\.venv\Scripts\python.exe .\ml-service\simulate.py --seed 42 --users 240 --sessions 40
.\.venv\Scripts\python.exe -m pytest .\ml-service -q -k simulator
```

Hinglish: “Real users nahi the, isliye simulator banaya. Uski hidden preferences baseline formula se alag hain. Results ko real-user proof nahi bol raha.”

## 4 — Temporal training

Plan: shown-candidate examples; 13 shared features using strictly earlier data; matured funnel labels; chronological split with embargo; actual XGBoost training and EDA.

Delivered: LambdaMART `rank:ndcg`, grouped requests, grades 0/1/2/3, 24-hour maturity gaps, validation-only selection, checksum/versioned model, metadata/model card and plots. Hidden preferences, user IDs and positions never become features.

```powershell
.\.venv\Scripts\python.exe .\ml-service\train.py
.\.venv\Scripts\python.exe -m pytest .\ml-service -q
```

Hinglish: “Model pairs of shown items ka relative order learn karta hai. Future information ko past features mein aane nahi diya.”

## 5 — Evaluation

Plan: explicit Precision@3, Recall@3 and graded NDCG@3; identical exposed candidate sets for baseline and ML; save results from code.

Delivered: 1,901 held-out test requests. Rules P/R/NDCG = 0.129756/0.291864/0.213192; ML = 0.153077/0.345739/0.271443. ML wins on this simulated experiment. Reports state observed-exposure/position bias and simulated-data limits. Request-bootstrap intervals are descriptive, not online significance claims.

```powershell
Get-Content .\ml-service\artifacts\EVALUATION.md
Get-Content .\ml-service\artifacts\evaluation.json
.\.venv\Scripts\python.exe -m pytest .\ml-service -q -k metrics
```

Hinglish: “Same test slates pe dono engines compare kiye. Simulated test mein ML better hai; real customers ke liye A/B test abhi baaki hai.”

## 6 — Integration and UI

Plan: authenticated internal HTTP scoring, timeout, category/stock filters, permanent cold-start/outage fallback, factual explanations, insights and CTR UI; local end-to-end verification.

Delivered: FastAPI scorer using the saved model and identical feature code; Node validates all scorer IDs/margins; response records actual serving engine. UI shows score semantics, simulated-data badge, artifact-driven metrics/importance/data summary, helpful controls, click tracking and real-event CTR. Layout retains lime/ink theme, supports narrow screens and lazy loads pages. Docker/Render setup and the subsequent rollout are recorded in DEPLOYMENT.md and RELEASE.md.

```powershell
# Terminal 1
npm run dev:local
# Terminal 2, backend root
.\.venv\Scripts\python.exe -m uvicorn app:app --app-dir ml-service --host 127.0.0.1 --port 8000
# Terminal 3, frontend root
npm run dev -- --host 127.0.0.1
# Terminal 4, backend root
npm run smoke:local
npm test
# Frontend root
npm run lint
npm run build
```

Verified locally: nine Node tests, eight Python tests, actual HTTP smoke report (`LOCAL_SMOKE.json`), browser registration/customer nav/cold-start cards/detail click/feedback/Insights. Python has one transitive TestClient deprecation warning. Compatible Node security fixes were applied; production npm audit found no advisories at the recorded check. Subsequent deployment checks are recorded in RELEASE.md. Real-user quality and sustained production load remain untested.
