# Data provenance: SIMULATED, not real-user evidence

The committed catalog and the training/evaluation run use **simulated data**. No real customer behavior was used to train this model. Offline improvements on this generator are not evidence of real-user performance or revenue lift.

## Reproduce

From the backend root in PowerShell, after installing Python 3.11 dependencies:

```powershell
.\.venv\Scripts\python.exe .\ml-service\simulate.py --seed 42 --users 240 --sessions 40
.\.venv\Scripts\python.exe .\ml-service\embeddings.py
.\.venv\Scripts\python.exe .\ml-service\train.py
```

The first script uses Python's dedicated `random.Random(seed)` and fixed dates. The default event SHA256 is recorded in `ml-service/data/summary.json`. Event bytes and hidden preferences are generated locally and ignored by Git; regenerate them from the committed script. Changing seed or generator assumptions creates a different experiment. `requirements.lock` records the actual installed packages; exact numeric results can still depend on platform/library builds.

## Catalog

128 synthetic packaged-grocery products span eight categories: Dairy, Detergent, Ice Cream, Coffee, Rice, Snacks, Shampoo and Tea. The original app's three categories are retained and five are added in this isolated demonstration catalog. Product/brand names resemble common retail products; descriptions, variants, prices, ratings, creation dates and stock are generated demonstration attributes, not a scraped or verified commercial dataset. No production catalog was changed. The legacy `seed.js` is retained for compatibility and is not the ML data generator.

`catalog.json` is committed so serving and training can use identical products. Every product and synthetic-user record carries `source: "simulated"`. Products exist before the interaction window. Stock, rating and price remain static within this experiment; this simplifies temporal features and limits realism. Historical event snapshots preserve the attributes known at serving time for future real-data training.

## Hidden user preferences and outcomes

Each simulated user has private category affinities (Gamma draws), a preferred brand per category, brand loyalty, a typical category-relative budget, price sensitivity and rating sensitivity. These latent parameters are saved only in ignored `users.json`; neither IDs nor latent preferences are ranker features.

Sessions are spread uniformly over 90 days from 2026-06-01. Category selection follows the user's category affinity. The source product is randomly selected in that category, independently of the preferred brand. Six different in-stock, same-category alternatives are actually exposed in a uniformly randomized order. This is an exploration policy, not a claim that the baseline produced those positions. The schema uses `engine: "rules"` and `modelVersion: "rules-v1"` for the exploration collector, with `policy: "uniform-random-exposure"` to preserve this distinction. No outcomes exist for unshown candidates.

The click utility is:

```
-3.4 + 2.15 * budget_fit
     + 1.65 * brand_loyalty * preferred_brand_match
     + rating_sensitivity * (rating - 3.8)
     + 0.25 * log(1 + category_affinity)
     + Normal(0, 0.45)
```

`budget_fit = exp(-price_sensitivity * abs(log(price / category_budget)))`.
Click probability is `sigmoid(utility) / log2(position + 1)`. This is a noisy, nonlinear, personalized generative mechanism. It does **not** use the baseline's weighted formula, source-price similarity, embedding similarity, or the model's predictions. Baseline scores on impressions are informational and never drive labels.

A click can progress to cart with conditional probability `0.18 + 0.23*budget_fit + 0.10*preferred_brand_match`; a cart can progress to purchase with `0.32 + 0.13*budget_fit`. Clicks occur 3–60 seconds after exposure, carts 1–15 minutes after click, purchases 5–120 minutes after cart. These are chosen assumptions, not fitted claims about customers. The actual realized counts/rates are in `summary.json`, not constants in the UI.

## Examples and labels

One row is `(user, source, actually shown candidate)` at its impression timestamp. Join outcomes by `impressionId`, user, product and the next 24 hours. Maximum funnel grade: ignored=0, click=1, cart=2, purchase=3. Unshown products are never negatives. FEEDBACK and VIEW are retained in events but are not relevance labels in v1. Ignored exposures are weak negatives, not proof of dislike. End-of-window impressions without 24 hours of observation are excluded.

All data-derived features use events strictly earlier than the impression. User affinities and price fit use at most the latest 1,000 positive events and their immutable product snapshots. Popularity uses weighted click/cart/purchase counts in the previous 14 days; trend compares the last seven days with the preceding seven. Embeddings use only names, categories, brands and descriptions; the frozen MiniLM model was not trained on this simulator. Category and stock are constant after filtering and have zero learned importance by design.

Requests split chronologically 60%/20%/20%. A 24-hour label-maturity gap removes rows whose outcomes could enter the next split. No user-random split, full-dataset aggregate or future outcome is used as a feature. Earlier validation/test outcomes may update subsequent histories, as they would online; model parameters remain frozen. This evaluates returning users, not unseen-user generalization. Only validation selects depth/early stopping; test is evaluated after selection.

## Real and simulated separation

The simulator writes local files and never imports simulated events into Atlas. The public event API derives identity from JWT, timestamps on the server, copies engine/score/position from a matching owned impression, rejects a client `source`, and always writes `source: "real"`. Anonymous impressions have `userId: null` and cannot receive attributed outcomes. Production Analytics filters explicitly for `source: "real"`; legacy seed logs without provenance are excluded. They remain stored for backward compatibility.

The disposable `npm run dev:local` catalog is labeled in the UI. Automated smoke tests write QA interactions through the real API into that temporary database only; they are not exported or included in model training. The smoke script refuses a connected database.

To export actual authenticated interactions later:

```powershell
npm run events:export
.\.venv\Scripts\python.exe .\ml-service\train.py --events .\ml-service\data\real-events.jsonl --source real
```

Set `MONGODB_URI` in local `.env` for export. The exporter refuses to overwrite an existing export. Files matching `real-*` are ignored: do not publish raw user interaction data. Exports use pseudonymous IDs without emails/passwords and still need appropriate retention/access controls. Real-data training needs enough matured requests and snapshots; it fails instead of inventing a result when data is insufficient. Back up the evaluated simulated artifacts before intentionally replacing them with a real-data model.

The CART/PURCHASE endpoints currently accept self-reported authenticated interactions tied to an exposure. The app has no payment/order system; these are not verified orders. Future commerce integration should emit purchase events from a trusted order backend.
