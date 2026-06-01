# MLB Residual Model Plan

## Goal

Improve run projection accuracy by training a small residual model on the gap between what the
analytical engine projects and what actually happens. The corrected projection becomes:

```
correctedRuns = analyticalProjection + residualCorrection
```

The analytical engine (`src/lib/mlbModel.ts`) is kept intact. It remains the interpretable core
that drives the UI and is the only model used in the browser. The residual model is a server-side
layer added to the automation pipeline only.

## Why a Residual, Not a Replacement

- Preserves full interpretability of the run projection breakdown shown in the UI
- The analytical model is sample-efficient — it works on day 1 of the season with no game history
- A residual model needs only ~400–600 graded games to be useful; a full replacement would need far more
- Systematic biases (certain parks, pitcher archetypes, weather extremes) can be learned and corrected
  without discarding the structure of the analytical model
- Rollback is trivial — just disable the correction step

## Architecture

```
predictGame()          → analyticalResult   (always computed, always stored)
applyResidualModel()   → Δ_home, Δ_away     (server-side only, stored separately)
correctedResult        → stored in MlbResidualCorrection, linked to MlbPrediction via lookupKey
```

The browser predictor and single-game tab always use the analytical result. The automation pipeline
optionally applies the residual correction for its DB-stored predictions.

---

## Phase 1 — Build the Training Dataset

**Gate:** ~400–600 graded prediction rows in Postgres (`MlbPrediction` joined to `MlbGameResult` via `lookupKey`).

### What to build

Add a new CLI command:

```bash
npm run cli -- export-residuals --from YYYY-MM-DD --to YYYY-MM-DD --file PATH
```

This joins `MlbPrediction` to `MlbGameResult` and exports a CSV with one row per graded game:

| Column | Source |
|---|---|
| `date` | `PredictionRun.date` |
| `lookupKey` | `MlbPrediction.lookupKey` |
| `homeTeam`, `awayTeam` | prediction metadata |
| `projectedHomeRuns`, `projectedAwayRuns` | `MlbPrediction` |
| `actualHomeRuns`, `actualAwayRuns` | `MlbGameResult` |
| `residualHome`, `residualAway` | actual − projected |
| All analytical input features | `MlbPrediction` stored JSON or reconstructed |

### Testing for Phase 1

- Unit test: given a known `MlbPrediction` row and a known `MlbGameResult` row with matching `lookupKey`,
  assert the exported CSV row has correct residual values
- Integration test: run `export-residuals` against a seeded sandbox DB and assert the output CSV has
  the expected row count and no null residual values
- Regression guard: assert the export fails clearly (non-zero exit, readable error) when no graded
  rows exist rather than silently producing an empty file

### Documentation for Phase 1

- Add `export-residuals` to the Commands section in `CLAUDE.md`
- Add the export workflow to the Manual CLI Validation Sequence in `RUNNING_THE_MLB_MODEL.md`

---

## Phase 2 — Choose and Train the Residual Model

**Gate:** Phase 1 complete with at least 400 graded rows exported.

### Recommended model: gradient boosted trees

Use XGBoost or LightGBM (Python). Reasons:
- Reliable with 500–2000 rows; does not require deep-learning data volumes
- Handles mixed numeric features without normalization
- Trains in seconds on a laptop
- Interpretable with SHAP values — confirms the residuals are signal, not noise
- No GPU required

A shallow neural network (2 hidden layers, ~64 units each) is a reasonable alternative once 2000+
rows are available.

### Training workflow

```
scripts/
  train_residual_model.py     # load CSV, train, evaluate, save model artifact
  evaluate_residual_model.py  # compare corrected vs analytical on held-out window
  requirements.txt            # xgboost / lightgbm, pandas, scikit-learn, shap
```

The trained model is serialized to `models/residual_home.json` and `models/residual_away.json`
(XGBoost native format or joblib pickle). These artifacts are gitignored — they are generated
artifacts, not source code.

### Backtesting before integration

Run the residual model against a held-out window (e.g. the final 2 weeks of each training month)
**before** integrating into the pipeline. Gate integration on the corrected model showing:
- Lower MAE on projected runs vs the analytical baseline
- Brier score improvement on win probability
- No systematic over/under-correction on high-total or low-total games

### Testing for Phase 2

- Unit test (Python): given a fixed training dataset fixture, assert the trained model's MAE is
  below a threshold on the held-out set — catches silent model degradation on retraining
- Assert `train_residual_model.py` exits non-zero if the input CSV has fewer than 200 rows,
  with a readable message
- Assert SHAP feature importances are computed and saved alongside the model artifact (needed for audit)
- Assert the serialized model files load cleanly and produce a numeric output for a known input vector

### Documentation for Phase 2

- Add `scripts/` training workflow to `RUNNING_THE_MLB_MODEL.md` under a new "Residual Model Training" section
- Document the Python dependency setup (`pip install -r scripts/requirements.txt`)
- Document how to retrain (when to retrain, what triggers a retrain)
- Add model artifact paths and gitignore entries to `CLAUDE.md`

---

## Phase 3 — Feature Set

Input features for the residual model. Start with what is already computed per prediction:

| Feature | Notes |
|---|---|
| `projectedHomeRuns`, `projectedAwayRuns` | analytical output as input — learns correction direction |
| `homeStarterEra`, `homeStarterFip` | raw starter quality |
| `awayStarterEra`, `awayStarterFip` | raw starter quality |
| `parkFactor` | already in analytical model but may have nonlinear residual |
| `temperature` | weather interaction |
| `windMph`, `windDirection` | encoded: Out=1, In=−1, Cross=0.5, Neutral=0 |
| `homeBullpenFatigue`, `awayBullpenFatigue` | encoded 0/1/2 |
| `homeOffenseVsR/L`, `awayOffenseVsR/L` | split ratings |
| `dayOfWeek` | schedule effects (Sundays, getaway games) |
| `monthOfSeason` | early-season vs late-season calibration drift |

Additions once collected:

| Feature | Notes |
|---|---|
| `homeRpgLast7`, `awayRpgLast7` | recent form — requires tracking RPG per team per date |
| `lineupQualityScore` | wRC+ weighted by confirmed/projected/thin status |
| `crossTimezoneTravel` | flag for 3+ timezone travel on day-of |
| `backToBack` | flag for games on consecutive days |

### Testing for Phase 3

- Assert all required feature columns are present in the exported CSV before training starts
- Assert encoded categorical features (wind direction, bullpen fatigue) are in the expected
  numeric range — catches upstream encoding bugs before they corrupt training

---

## Phase 4 — Integration

**Gate:** Phase 2 backtesting shows MAE improvement over the analytical baseline.

### Server-side integration

Add a new service `server/services/residualCorrection.ts`:

```typescript
export function applyResidualCorrection(
  analyticalResult: PredictionResult,
  features: ResidualFeatureVector,
): ResidualCorrection  // { deltaHome: number; deltaAway: number }
```

This service loads the serialized model artifact via a Python subprocess call or a pre-computed
lookup table (if keeping the stack in TypeScript). The correction is applied after `predictGame()`
in the automation pipeline only — not in the browser.

### New DB table: `MlbResidualCorrection`

```
MlbResidualCorrection
  lookupKey         String   (FK to MlbPrediction)
  deltaHome         Float
  deltaAway         Float
  correctedHome     Float
  correctedAway     Float
  modelVersion      String   (git SHA or semver tag of the model artifact)
  createdAt         DateTime
```

Store analytical and corrected projections separately. This enables side-by-side comparison and
rollback without data loss.

### New CLI command

```bash
npm run cli -- apply-residual-corrections --date YYYY-MM-DD
```

Reads stored predictions for the date, applies corrections, writes `MlbResidualCorrection` rows.

### Testing for Phase 4

- Unit test: `applyResidualCorrection` given a known feature vector returns the expected `Δ_home` /
  `Δ_away` (pin against a fixed model artifact in test fixtures)
- Unit test: corrected projections are clamped to reasonable run totals (no negative runs, no 15-run
  projections from a bad correction)
- Integration test: run `apply-residual-corrections` against a seeded sandbox DB; assert
  `MlbResidualCorrection` rows are written with the correct `lookupKey` linkage
- Regression test: run the full pipeline end-to-end (analytical → residual → DB write) and assert
  both `MlbPrediction` and `MlbResidualCorrection` rows exist for each game
- Rollback test: assert that disabling residual correction (e.g. `ENABLE_RESIDUAL_CORRECTION=false`)
  leaves `MlbPrediction` rows unchanged and produces no `MlbResidualCorrection` rows

### Documentation for Phase 4

- Add `apply-residual-corrections` to the Commands section in `CLAUDE.md`
- Document `MlbResidualCorrection` table in the Database section of `CLAUDE.md`
- Document `ENABLE_RESIDUAL_CORRECTION` env var in `.env.example` and `CLAUDE.md`
- Update `RUNNING_THE_MLB_MODEL.md` pipeline workflow to show where the correction step sits
- Update `MLB_AUTOMATION_PLAN.md` delivery shape to include residual correction as Phase 4

---

## Phase 5 — Evaluation and Iteration

Use the existing `EvaluationSummary` and `CalibrationRun` infrastructure to compare corrected vs
uncorrected predictions on a rolling held-out window (last 2 weeks of each calendar month).

### Key metrics

| Metric | Description |
|---|---|
| MAE (runs) | Mean absolute error on projected home/away runs |
| Brier score | Calibration of win probability |
| O/U calibration | % of overs correctly called at each probability bucket |
| Residual bias by team | Identify teams the model systematically gets wrong |
| Residual bias by park | Identify parks the model systematically gets wrong |

### New CLI command

```bash
npm run cli -- evaluate-residual --from YYYY-MM-DD --to YYYY-MM-DD
```

Outputs a side-by-side comparison of analytical vs corrected MAE and Brier score.

### Retraining cadence

Retrain when:
- 200+ new graded games have accumulated since the last training run
- MAE on the rolling 2-week window degrades more than 0.15 runs vs the baseline
- A significant rule change occurs mid-season (rule changes alter run environment systematically)

### Testing for Phase 5

- Unit test: `evaluate-residual` produces output for a known fixture and includes both analytical
  and corrected MAE values
- Assert that when corrected MAE exceeds analytical MAE (model is hurting, not helping), a
  warning is printed and the command exits with a non-zero code
- Assert the rolling calibration curve is saved alongside the evaluation summary

### Documentation for Phase 5

- Add `evaluate-residual` to the Commands section in `CLAUDE.md`
- Add the retraining cadence and trigger criteria to `RUNNING_THE_MLB_MODEL.md`
- Add the evaluation comparison workflow to `MLB_AUTOMATION_PLAN.md`

---

## Summary: All CLI Commands Added by This Plan

| Command | Phase | Purpose |
|---|---|---|
| `export-residuals` | 1 | Export training dataset from graded predictions |
| `apply-residual-corrections` | 4 | Apply trained model corrections to a date's predictions |
| `evaluate-residual` | 5 | Compare analytical vs corrected accuracy on a date range |

## Summary: All Tables Added by This Plan

| Table | Phase | Purpose |
|---|---|---|
| `MlbResidualCorrection` | 4 | Store per-game residual corrections alongside analytical predictions |

## Summary: Test Coverage Targets

| Area | Type | Phase |
|---|---|---|
| `export-residuals` residual math | Unit | 1 |
| `export-residuals` against seeded DB | Integration | 1 |
| `export-residuals` empty-data failure | Regression | 1 |
| Python training MAE gate | Unit (Python) | 2 |
| Python min-rows guard | Unit (Python) | 2 |
| SHAP artifact saved | Unit (Python) | 2 |
| Model serialization roundtrip | Unit (Python) | 2 |
| Feature encoding range check | Unit | 3 |
| Required feature columns present | Unit | 3 |
| `applyResidualCorrection` output pin | Unit | 4 |
| Clamping of corrected projections | Unit | 4 |
| `apply-residual-corrections` DB write | Integration | 4 |
| Full pipeline end-to-end | Regression | 4 |
| Rollback / disable guard | Regression | 4 |
| `evaluate-residual` output shape | Unit | 5 |
| Degradation warning / non-zero exit | Regression | 5 |

## Summary: Documentation Targets

| Document | Updates |
|---|---|
| `CLAUDE.md` | Commands, Architecture, Database, Key Docs, env vars |
| `RUNNING_THE_MLB_MODEL.md` | Residual training workflow, pipeline step, retraining cadence |
| `MLB_AUTOMATION_PLAN.md` | Residual correction as Phase 4 in the delivery shape |
| `MLB_PREDICTOR_BUILD_PLAN.md` | Model evolution roadmap note |
| `.env.example` | `ENABLE_RESIDUAL_CORRECTION` var |

---

## Additional Concerns

### Graceful Fallback When the Model Artifact Is Missing or Fails

The `applyResidualCorrection` service must never crash the nightly pipeline. If the model artifact
file is missing (new machine, artifact not deployed), corrupt, or the subprocess call fails, the
service must catch the error, log a warning, and return `{ deltaHome: 0, deltaAway: 0 }` — a
no-op correction that leaves the analytical projection unchanged.

Fallback policy:
- Log a structured warning: `[residualCorrection] model artifact not found — falling back to analytical projection`
- Return zero deltas; do not throw
- The `MlbResidualCorrection` row is **not** written when the fallback fires, so the absence of a
  row is a signal that the correction was not applied
- The `evaluate-residual` command must handle missing correction rows gracefully — it compares
  corrected vs analytical only for rows where a correction exists

**Testing:** assert that `applyResidualCorrection` returns zero deltas and logs a warning when
the model artifact path does not exist, rather than throwing.

---

### Data Quality Validation Before Training

The raw training export contains real-world noise that can distort a small model:
- **Incomplete games** (rain, mercy rule, suspended) produce abnormal scores. Filter out any game
  where `actualHomeRuns + actualAwayRuns < 5` or where the game was flagged as non-standard in
  the result record
- **Duplicate `lookupKey` rows** — can occur if the pipeline ran twice on the same date. Deduplicate
  by keeping the row with the most recent `predictionRun.createdAt`
- **Extreme outlier scores** — scores above the 99th percentile of historical totals (roughly 20+
  combined runs) distort residuals. Flag and optionally exclude; at minimum log a count of flagged rows
- **Missing feature values** — null `temperature`, null `windMph`, null park factor should cause
  the export row to be flagged and excluded from training, not silently passed through with zeros

The training script (`train_residual_model.py`) must print a data quality report before fitting:
row count, excluded rows with reasons, feature null counts. Gate training on at least 200 clean rows.

**Testing:** assert that the export CLI prints a summary of excluded rows; assert the training
script refuses to continue if more than 30% of rows are excluded.

---

### Season Rollover Strategy

The analytical model is re-seeded with new team ratings at the start of each season. Prior-season
residuals were trained against old ratings and may not transfer.

**Policy:**
- **Suppress the residual correction for the first 6 weeks of each season (April 1 – May 15)**
  even if prior-season artifacts exist. The analytical model is re-seeded; the old residuals
  have no valid baseline to correct against.
- **Retrain from scratch each season.** Do not carry prior-season rows into the new training set.
  The run environment, rosters, and park factors all change enough to make cross-season residuals
  unreliable.
- **Track the training data date range in the model artifact metadata.** If the artifact's
  `trainingFromDate` is from a prior calendar year and today is after April 1, treat the artifact
  as stale and fall back to the analytical projection.

Add a `scripts/model_metadata.json` file alongside the serialized artifact:
```json
{
  "modelVersion": "2026-05-20",
  "trainingFromDate": "2026-04-15",
  "trainingToDate": "2026-05-18",
  "trainingRowCount": 412,
  "heldOutMAE": 1.23,
  "analyticalBaselineMAE": 1.41
}
```

**Testing:** assert that `applyResidualCorrection` checks `model_metadata.json` and falls back to
zero deltas (with a warning) when `trainingFromDate` is from a prior calendar year and the current
date is between April 1 and May 15.

---

### Model Artifact Versioning and Promotion Workflow

The `modelVersion` field in `MlbResidualCorrection` is only useful if the versioning scheme is defined.

**Convention:** use `YYYY-MM-DD` (the date the training run was executed). If multiple training
runs happen on the same day, append `-2`, `-3`, etc.

**Directory layout:**
```
models/
  residual_home.json          ← current artifact (symlink or overwrite)
  residual_away.json          ← current artifact
  model_metadata.json         ← current metadata
  archive/
    2026-05-20/
      residual_home.json
      residual_away.json
      model_metadata.json
```

The `archive/` directory preserves prior versions. The training script writes to `archive/YYYY-MM-DD/`
first, then copies to the top-level `models/` directory on success.

**Rollback:** to roll back to a prior version, copy from `archive/YYYY-MM-DD/` back to `models/`.

**Promotion gate:** the training script only writes to `models/` (the "current" slot) if the
held-out MAE is lower than the analytical baseline. If the new model is worse, it is archived but
not promoted, and the pipeline continues using the prior current artifact.

**Testing:** assert that the training script writes to `archive/` before promoting; assert that
a model that fails the MAE gate is archived but does not overwrite `models/residual_home.json`.

---

## Current Status

- [x] Phase 1 — Export residuals CLI command (`server/services/residualExport.ts`, `cli.ts`)
- [x] Phase 2 — Residual model training scripts (`scripts/train_residual_model.py`, `scripts/requirements.txt`)
- [x] Phase 3 — Feature set finalized (see `buildFeatureVector` in `residualCorrection.ts`)
- [x] Phase 4 — Server-side integration and DB table (`MlbResidualCorrection`, `residualCorrection.ts`)
- [x] Phase 5 — Evaluation CLI command (`evaluate-residual`, `scripts/evaluate_residual_model.py`)
- [ ] Phase 5 (runtime) — Collect 400+ graded rows, train first model, promote artifact, enable correction
