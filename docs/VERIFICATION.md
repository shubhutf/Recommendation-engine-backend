# Local verification — 16 October 2026

- Node API suite: **9 tests passed**, including role protection, stale-token login recovery, scrypt/JWT expiry checks, event ownership/idempotency/provenance, baseline cold start, scorer validation/outage/real HTTP deadline, product cleanup, artifact loading and delayed impression persistence.
- Python suite: **8 tests passed**, including generator determinism/funnel order, real MiniLM dimensions/norm/cache invalidation, future-event exclusion, exposure-only matured labels, known ranking metrics, chronological embargo, strict popularity windows and actual saved-model FastAPI scoring.
- Python TestClient emits one transitive AnyIO deprecation warning; tests pass.
- Frontend `npm run lint`: passed with no warnings. `npm run build`: passed; page splitting removes the prior large-single-bundle warning.
- Real HTTP smoke: `docs/LOCAL_SMOKE.json`, anonymous/customer cold start → six distinct clicked products → actual Python ML scores, feedback, metadata and analytics.
- Cross-language baseline parity: every same-category non-self pair in the 128-product catalog, **1,920 pairs**, matched JavaScript vs Python scores exactly.
- Browser verification: dashboard/live catalog, customer registration, hidden admin navigation, cold-start cards, tracked details, feedback, metrics/importance/dataset/cold-start on ML Insights. Preview screenshot is committed in the frontend `screenshots/ml-insights.jpg`.
- Frontend dependency audit after compatible lockfile updates: zero advisories.
- Production Node dependencies: `npm audit --omit=dev` found zero advisories at the local check after compatible upgrades. No credentials, raw generated/real interaction exports, virtual environment, model download weights or local databases are committed.

Tests used disposable local MongoDB. No Atlas connection, Render/Vercel deployment, remote Git push, real-user study or Docker build was performed. The saved model metrics are simulated-data reranking metrics only.
