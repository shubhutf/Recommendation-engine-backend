# Production release — 17 October 2026

The owner authorized browser publishing and deployment. Changes were uploaded through GitHub's web UI on `feature/personalized-ml-ranking` and merged through pull requests. No GitHub CLI or terminal push was used.

## Live services

| Service | URL | Release source |
| --- | --- | --- |
| Frontend | https://recommendation-engine-frontend-kappa.vercel.app/ | Frontend PR #1, merge `dcbe7c6a62c1d32173626700e6ef2f843fd5a040` |
| Express API | https://recommendation-engine-backend-mo3c.onrender.com/api/v1 | Backend PR #7, merge `60a7e77b83bded1c7d57ae21f044d1de32b5c4a7` |
| Python scorer | https://recommendation-engine-ml.onrender.com/health | Backend `main`, root `ml-service`, CPU Docker image |

- [Backend implementation PR #7](https://github.com/shubhutf/Recommendation-engine-backend/pull/7) merged with the owner's explicitly authorized exception to the required approving review. Repository rules were not edited.
- [Frontend implementation PR #1](https://github.com/shubhutf/Recommendation-engine-Frontend/pull/1) merged after both Vercel checks passed.
- Existing Git integrations automatically deployed the API and frontend after the main merges. Vercel login was unnecessary for this rollout.
- Render API deployment `dep-db973uoae00c739a0ceg` reported **Deploy succeeded | Live**. Its build reported zero npm vulnerabilities and runtime connected to MongoDB.
- The scorer's initial Docker deployment `dep-db960u6k1f9s73fnm0r0` succeeded and `/health` returned `ready: true`, model `v1-f196f47d`. It was then switched from the feature branch to `main` for future updates; deployment `dep-db974d8473hc73b0ro30` also passed readiness and `/health` again returned the same ready model version.

## Observed production checks

- API `/api/v1/health`: success, `dataMode: connected-database`.
- Direct frontend `/ml-insights`: loads the React route and artifact API, showing model `v1-f196f47d`, held-out metrics, gain importance, dataset counts and simulated-data notice.
- Direct `/products`: loads the existing MongoDB catalog, with customer/anonymous navigation and no admin mutation controls.
- `/login` and `/register`: display the expected customer forms.
- `vercel.json` fixes direct-route refreshes that previously returned Vercel 404.
- Production catalog/inventory were not reseeded and no synthetic training histories or QA outcomes were inserted into Atlas. Auth, event writes, actual ML scoring and failure behavior were exercised against disposable local MongoDB; see the backend `docs/VERIFICATION.md` and `docs/LOCAL_SMOKE.json`.

## Configuration and practical limits

The existing API and new scorer use Render **Free** instances; no paid upgrade was selected. Both can sleep after inactivity. The frontend allows 70 seconds for the API to wake. Node waits up to 5 seconds for the scorer and returns the permanent rules fallback on cold start, timeout or error. The API requires five distinct positively interacted products before it attempts personalization.

JWT and ML service secrets are saved only in Render environment settings. The frontend receives no service token or Gemini key. The scorer validates its saved model checksum at startup and uses pinned MiniLM representations. Its root path returns 404 by design; `/health` is the readiness endpoint.

This is a working deployed demonstration, not a sustained-load or real-user validation claim. The model was trained and evaluated on simulated data. Its NDCG@3 is 0.271443 versus 0.213192 for rules on 1,901 held-out simulated requests. Durable impression delivery, verified order outcomes, stronger session lifecycle controls and long-running resource testing remain documented engineering work.
