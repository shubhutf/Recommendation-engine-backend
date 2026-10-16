# Backend architecture and conventions

- Node/CommonJS, Express 4, Mongoose 8. `server.js` connects MongoDB then mounts `src/app.js`.
- Product/inventory: routes → controllers → services → models under `src/`.
- Recommendation HTTP entry is root `recommendationRoutes.js`; permanent deterministic scorer is `recommendationService.js`. Gemini (`aiExplanationService.js`) only explains selected results. `src/controllers/recommendation.controller.js` is unused legacy code.
- `inventory` is an explicit Mongo collection name. Keep this binding. Preserve legacy `recommendations` impression records.
- Auth and interaction code belongs in `src/`; Python training/inference belongs in `ml-service/`.
- Work on feature branches from `develop`; small phase commits, never commit `.env`, credentials, local databases, downloaded model weights, or virtual environments.
- Commands: `npm ci`, `npm run dev`, `npm start`, `npm test`. ML commands and phase checks are documented in README and docs/PHASES.md as they are implemented.
- No invented metrics. Commit reproducible simulator/trainer, actual model and evaluation artifacts; explicitly separate simulated from real data.
- Security: public registration always creates customers. Provision admins locally, never accept a role from registration. Writes require admin authorization.
- Keep this document updated when entry points or commands change.

## Implemented entry points and checks

- Auth: `src/routes/auth.routes.js`, `src/services/auth.service.js`, `scripts/create-admin.js`. Server requires JWT_SECRET >=32 bytes. Registration never accepts role.
- Events: `src/models/event.model.js`, `src/routes/event.routes.js`, `src/services/event.service.js`. Public outcomes require owned exposure IDs and cannot set provenance. Impression queue is bounded/best effort; `drain()` supports graceful shutdown/tests.
- Ranking: `src/services/ml.service.js` calls Python with a deadline; root route returns actual engine/version/fallback reason. Stock/category constraints are rechecked. Baseline formula remains permanent, with explicit ID tie-breaking.
- ML: `ml-service/simulate.py`, `embeddings.py`, `features.py`, `dataset.py`, `train.py`, `evaluate.py`, `app.py`. Artifacts are real, versioned and checked in; raw generated/real data are ignored. Use pinned feature order and shared temporal function.
- Local demo: `npm run dev:local` starts disposable Mongo/API without Atlas. `npm run smoke:local` refuses connected databases and verifies actual HTTP model integration. `npm run events:export` writes an ignored real-only export.
- Verified commands: `npm test`, Python `-m pytest ml-service -q`, frontend lint/build, full HTTP smoke. PowerShell invocations in README/docs/PHASES.md. Python uses 3.11; serving uses Node 22+.
- Demo smoke actions are QA data in a disposable database, never training observations. Analytics excludes all simulated and unknown-provenance legacy rows.
- Deployment not performed. Keep limitations in docs/DATA.md, docs/DEPLOYMENT.md and INTERVIEW_NOTES.md honest.
