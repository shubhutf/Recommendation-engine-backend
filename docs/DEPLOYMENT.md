# Deploy later: no deployment was performed

Run and verify all services locally first. The existing Vercel/Render deployments remain untouched.

## Internal Python scorer on Render

Use the backend repo, root directory `ml-service`, Docker environment and the included Dockerfile. The build installs Python dependencies, Linux OpenMP and the pinned MiniLM model. `ranker.ubj`, `metadata.json` and the vector cache must be included from the reviewed commit. The Docker path is provided as deployment preparation; Docker/Render deployment has not been run here.

Set `ENVIRONMENT=production` and a strong random `ML_SERVICE_TOKEN`. Use a private Render service/internal URL reachable from the Node service, or authenticate the public service with that token. The service has no browser CORS configuration by design. The image uses `$PORT` (default 8000); health check is `/health`. Choose resources after measuring startup memory and CPU latency: PyTorch/MiniLM is heavier than Node and may not fit a small free instance. A suspended service can exceed the Node timeout and correctly produce rule-based results.

The service verifies the model checksum and feature/embedding revision on startup, and preloads MiniLM once. New or edited product text is encoded and cached with the same revision. Its first request can exceed the Node timeout; that request falls back and later requests reuse cached vectors. Use a persistent writable cache or expect cache regeneration on restart. Keep Python package/model artifacts consistent; metadata describes the exact trained version.

## Node Render service

Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 bytes, `JWT_EXPIRES_IN=2h`, `CORS_ORIGIN` to the Vercel origin, `ML_SERVICE_URL` to the Python internal base URL, and the matching `ML_SERVICE_TOKEN`. `ML_TIMEOUT_MS=1500` (clamped 100–5000) bounds scoring HTTP time. `ML_MIN_HISTORY=5` counts distinct positively interacted products. `GEMINI_API_KEY` is optional; it only writes factual descriptions and has a 2.5-second timeout per request.

Use `npm ci --omit=dev` then `npm start`. Node 22+ is required (native fetch/AbortSignal and watch support). Provision an admin once with `npm run admin:create` in a trusted shell, supplying `ADMIN_EMAIL`/`ADMIN_PASSWORD` as environment variables. Public registration cannot create admins. Do not expose admin provisioning as a public HTTP route. Password hashes and JWT secrets must stay server-side.

## Vercel frontend

Set `VITE_API_BASE_URL=https://YOUR-NODE-HOST/api/v1`, build `npm run build`, output directory `dist`. Keep the existing SPA rewrite to `index.html`. Browser traffic always goes to Node, never directly to the Python scorer. Rebuild when changing a Vite environment variable.

## Operational limitations to address before claiming production maturity

Impressions use a bounded in-process best-effort queue (100 concurrent batches), with observable dropped-batch counts. A restart can lose impressions; the old/new log writes are not atomic. A durable queue/outbox is needed for strong delivery guarantees. HTTP outcome writes await Mongo and are deduplicated by exposure and event type. Analytics CTR can be biased if impression logging drops.

Product deletion removes current inventory and legacy recommendation references; immutable event snapshots remain for temporal training. Cleanup is not a multi-document transaction, so failures/races need reconciliation for strong consistency. Candidate retrieval is bounded to 200 same-category products ordered by ID; consider a retrieval stage if catalogs grow. The legacy analytics summary still scans real legacy impression rows; use aggregate counters/materialized views at higher scale.

JWT logout clears the browser session token; it does not revoke an already stolen token before its expiry. SessionStorage is script-readable. Add cookie/CSRF design, revocation/refresh strategy, email verification/reset, verified purchase events, monitoring and durable logging as the product's production requirements grow. No online A/B test or causal uplift claim has been made.
