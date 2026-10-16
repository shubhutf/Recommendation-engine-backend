# Restock recommendation backend

Express + MongoDB API with JWT customer/admin access, attributed interaction events, a permanent deterministic fallback, and an evaluated XGBoost ranking model served by FastAPI. Gemini only describes the selected products; it never chooses or ranks them.

The checked-in model was trained on **simulated data**. Results below are actual held-out reranking metrics, not evidence of real-user performance. No deployment was performed.

| Engine | Precision@3 | Recall@3 | NDCG@3 |
|---|---:|---:|---:|
| Rules | 0.129756 | 0.291864 | 0.213192 |
| XGBoost | 0.153077 | 0.345739 | 0.271443 |

Source: [`ml-service/artifacts/evaluation.json`](ml-service/artifacts/evaluation.json), 1,901 test requests. Model `v1-f196f47d`; 240 simulated users, 128 synthetic products, 77,890 events. Full scope, assumptions and caveats: [DATA](docs/DATA.md), [evaluation report](ml-service/artifacts/EVALUATION.md), [model card](ml-service/artifacts/MODEL_CARD.md).

## Local demo without Atlas or secrets

Requirements: Node 22+, Python 3.11, internet for package/model/Mongo binary downloads on first setup. Commands are PowerShell-compatible, starting from the parent folder containing both repos.

```powershell
Set-Location .\Recommendation-engine-backend
npm ci
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\ml-service\requirements.lock
npm run dev:local
```

This starts a disposable MongoDB and the API at `http://127.0.0.1:5000/api/v1`, loads the clearly labeled synthetic catalog, and generates a process-local JWT signing key. Accounts/events reset on exit. No Atlas URI is read and Gemini is disabled. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in that shell before starting to provision a local admin. Register normal customers through the frontend.

In a second terminal, from this backend directory:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app:app --app-dir ml-service --host 127.0.0.1 --port 8000
```

First startup downloads the pinned pretrained MiniLM weights into ignored `ml-service/.cache/`. The committed product vector cache and XGBoost model are already available.

In a third terminal, from the common parent:

```powershell
Set-Location .\Recommendation-engine-Frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. The frontend defaults to the loopback API URL. The explicit IPv4 address also avoids macOS AirPlay intercepting `localhost:5000` during local verification.

## Checks and full training

From the backend directory, while the demo and Python services are running for the smoke check:

```powershell
npm test
.\.venv\Scripts\python.exe -m pytest .\ml-service -q
npm run smoke:local
```

`npm test` creates its own isolated MongoDB and checks role guards, credentials/expiry, real-event attribution/deduplication, separation from simulated events, exact rule fallback, invalid/outage/slow scorer fallback, deletion cleanup and artifact loading. `smoke:local` checks actual Node → FastAPI → saved-model inference and refuses a connected database. Its actual report is [LOCAL_SMOKE.json](docs/LOCAL_SMOKE.json). QA events exist only in the disposable database and never enter training data.

To regenerate the simulated experiment:

```powershell
.\.venv\Scripts\python.exe .\ml-service\simulate.py --seed 42 --users 240 --sessions 40
.\.venv\Scripts\python.exe .\ml-service\embeddings.py
.\.venv\Scripts\python.exe .\ml-service\train.py
```

Training builds point-in-time examples, splits requests chronologically with 24-hour label-maturity gaps, selects between two depths using validation only, saves the model, and evaluates held-out test requests. Artifacts: `ranker.ubj`, `metadata.json`, `evaluation.json`, `EVALUATION.md`, `MODEL_CARD.md`, `eda.json`, `eda.png`, `embeddings.json`. Raw generated events/preferences/examples are ignored and reproducible. [Phase commands](docs/PHASES.md) and [interview notes](INTERVIEW_NOTES.md) explain the design.

On macOS/Linux use `python3.11 -m venv .venv` and `.venv/bin/python` in place of the Windows Python paths above. This implementation was run locally on macOS with Node 25 and Python 3.11.

## Connect your own development MongoDB

Do not use the disposable demo command for persistent data:

```powershell
Copy-Item .env.example .env
$env:JWT_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))"
# Edit .env: set MONGODB_URI, CORS_ORIGIN and optional ML/Gemini configuration.
npm run dev
```

Mongo uses database `recommendation_engine`. JWTs use salted scrypt password hashes, HS256, issuer/audience checks and a default two-hour expiry. Registration always creates a customer; protected mutations check the current database role, not a client role.

Create an admin once in a trusted shell with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set, then run `npm run admin:create`. The CLI refuses to change an existing account. Clear those shell variables afterward. Never commit `.env` or credentials. No public endpoint creates admins.

## API

All paths below are under `/api/v1`. Normal product/inventory read response envelopes are preserved. Recommendation and analytics responses remain plain JSON.

| Method/path | Access / behavior |
|---|---|
| `GET /health` | Readiness and database mode; no credentials |
| `POST /auth/register`, `/auth/login` | `{email,password}` → `{token,user}`; rate limited |
| `GET /auth/me` | Bearer token → current user |
| `GET /products`, `/inventory` | Public browse |
| `POST /products`, `PUT/DELETE /products/:id` | Admin only |
| `POST /inventory`, `PUT /inventory/:id` | Admin only |
| `GET /recommendations/:productId` | Optional JWT; engine/version/reason, scores, embedded products and exposure IDs |
| `POST /events` | Authenticated VIEW/CLICK/CART/PURCHASE/FEEDBACK; source/identity/time/attribution server owned |
| `GET /analytics/summary` | Real-provenance logs only; CTR by engine/position; logging drops |
| `GET /ml/insights` | Saved evaluated metadata/metrics/importance; 503 if artifacts absent |

Recommendation outcomes require `{eventType,productId,impressionId}`; FEEDBACK also requires `feedback: "helpful"` or `"not-helpful"`. A direct VIEW can omit `impressionId`. Duplicate outcomes per type/exposure are idempotent; feedback can be changed. CART/PURCHASE are self-reported intent signals until a trusted order service is added, not verified payments.

## Architecture and serving

```
React → Node API → Mongo: auth, source + category candidates + inventory
                 → cold start? deterministic rules
                 → else Python: shared features → XGBoost ranking margin
                 → timeout/error? deterministic rules
                 → top 3 → factual Gemini/local descriptions → JSON
                 → bounded asynchronous events + legacy recommendations logs
```

The baseline remains `0.4*category + 0.2*priceSimilarity + 0.2*(rating/5) + 0.2*inStock`, including its cheaper-product bonus and three-decimal rounding. In-stock ranks first and ties use product ID. Baseline fallback retains out-of-stock alternatives when necessary; ML filters them out entirely. Candidates always match category and exclude the source; retrieval caps at 200 products. Anonymous users and users with fewer than five distinct positively interacted products use rules. HTTP scoring has a configurable 1.5-second deadline. ML margins are not calibrated probabilities or comparable with baseline percentages.

`src/` owns product/inventory/auth/events; root recommendation modules own orchestration and baseline; `analytics/` owns summaries; `ml-service/` owns shared Python features, simulation, training and scoring. `inventory` stays explicitly bound to that collection. The old `src/controllers/recommendation.controller.js` is unused.

See [deployment preparation and operational limits](docs/DEPLOYMENT.md) before deploying. No production data or external deployments were modified.
