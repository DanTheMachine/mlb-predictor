# MLB Predictor Context

This folder contains the working MLB predictor app for the `game_sims` workspace.

## Current Product State

- React + TypeScript + Vite app is live
- tabs exist for `Predictor`, `Results Tracker`, and `Model Eval`
- `Results Tracker` and `Model Eval` are now independent workflows
- Predictor tab contains:
  - MLB model data refresh
  - daily schedule workflow
  - bulk line editing
  - single-game tools in a collapsible panel
- built-in blended default team ratings
- daily schedule cards support:
  - probable starters
  - lineups
  - weather
  - odds
  - three market-specific composite recommendation cards (`ML`, `O/U`, `RL`)
  - projected score + best composite recommendation in the game-card header
  - visible team rating inputs used by the model

## Current Daily Workflow

1. Set `Live Slate Date`
2. Click `Fetch MLB Data`
   - refreshes team-level model ratings from MLB team stats
   - requests current-season MLB team hitting / pitching / fielding plus split hitting stats
   - falls back one season only if current-season data is too incomplete
   - updates the `Teams Updated` chip
3. Click `Load Games`
   - loads slate games for the selected date
   - loads probable starters and lineup state
   - loads weather
   - interprets wind direction relative to the home park orientation
   - loads ESPN odds when available
4. Optionally use `Bulk Edit Lines`
   - pasted odds now override active game odds as `manual`
   - manual odds count as valid market odds
   - this should not reset lineup/weather state
5. Click `Run All Sims`
6. Export `Predictions CSV`
7. Export `Results CSV`

## Results Tracker Workflow

- The `Results Tracker` tab now mirrors the NBA-style import flow rather than depending on `Model Eval`
- It owns its own state through `src/hooks/useResultsTracker.ts`
- It supports:
  - pasting exported predictions CSV
  - pasting results CSV
  - downloading yesterday's MLB results directly from the tracker
  - independent grading summaries for `ML`, `RL`, and `O/U`
  - a running graded game log
- The tracker UI now keeps two visible side-by-side textareas:
  - `Predictions CSV`
  - `Results CSV`
- Summary cards show pushes inline as `W-L-P`

## Model Eval Workflow

- `Model Eval` remains a separate calibration / threshold-tuning screen
- It no longer feeds state into `Results Tracker`
- It still consumes the same exported predictions + results CSV data through `src/lib/modelEvaluation.ts`

## Odds Sources

The app now distinguishes three odds sources:

- `espn`
  - live odds from ESPN
- `manual`
  - pasted or user-edited odds
- `model`
  - generated fallback odds when no market odds are available

Important behavior:

- `Odds live` counts both `espn` and `manual`
- `Market fallback active` only means the card is still using `model` odds
- live summary chips stay gray before a live load attempt
- after a live load:
  - green means all eligible games updated
  - yellow means partial update coverage
  - red means the load failed or coverage is still `0`
- already-started games do not count against the lineup / odds / weather chip denominators

## Header Summary Behavior

Daily schedule card headers now show:

- `Proj Score: AWAY x.xx - HOME y.yy`
- `Comp Rec: ...` using the strongest active composite market

When the composite recommendation is a total, the header includes the market and price, for example:

- `Comp Rec: OVER 8.5 -115`

## Composite Recommendation Cards

After `Run All Sims`, each expanded daily schedule card now shows:

- `Composite ML Recommendation`
- `Composite O/U Recommendation`
- `Composite RL Recommendation`

Important behavior:

- each market gets its own tier, score, pick, and reasons
- displayed composite scores are on a `0-10` scale
- `PASS` / `C` / `B` / `A` color-coding is used for market edge percentages and recommendation text
- total-card reasons should explain total-related drivers such as projected total vs market total, weather, and run environment

## Grading / CSV Flow

`Predictions` export includes the grading fields used by the evaluator:

- recommendations for ML / RL / total
- edge percentages
- all market odds needed for ROI later
- `Away` and `Home` export as `ABBR TeamName` so spreadsheet formulas can safely derive team abbreviations
- `LookupKey` as the last column

`Results` export includes:

- `Date`
- `Home`
- `HomeScore`
- `Away`
- `AwayScore`
- `Winner`
- `Total`
- `LookupKey`

Important behavior:

- result rows use MLB `officialDate` for `Date` and `LookupKey`, not the UTC `gameDate`
- this avoids late West Coast games rolling into the next calendar day in exports

These are consumed by both:

- `src/lib/modelEvaluation.ts`
- `src/lib/resultsTracker.ts`

## Key Files

- `src/components/ResultsTracker.tsx`
- `src/components/ModelEvaluation.tsx`
- `src/components/ScheduleAnalysis.tsx`
- `src/components/SingleGameControls.tsx`
- `src/components/SingleGameResults.tsx`
- `src/hooks/useMlbModelData.ts`
- `src/hooks/usePredictorState.ts`
- `src/hooks/useResultsTracker.ts`
- `src/lib/mlbApi.ts`
- `src/lib/teamRatings.ts`
- `src/lib/mlbModel.ts`
- `src/lib/modelEvaluation.ts`
- `src/lib/resultsTracker.ts`
- `proxy.ts`
- `.github/workflows/ci.yml`

## CI

GitHub Actions CI now exists for the MLB predictor.

Current workflow coverage:

- lint
- typecheck
- unit tests
- build
- Playwright e2e
- focused Results Tracker coverage now exists for:
  - `src/hooks/useResultsTracker.test.ts`
  - `src/components/ResultsTracker.test.tsx`
  - parser compatibility in `src/lib/modelEvaluation.test.ts`
