# MLB Predictor Context

This folder contains the working MLB predictor app for the `game_sims` workspace.

## Current Product State

- React + TypeScript + Vite app is live
- tabs exist for `Predictor`, `Results Tracker`, and `Model Eval`
- Predictor tab contains:
  - MLB model data refresh
  - daily schedule workflow
  - bulk line editing
  - single-game tools in a collapsible panel
- daily schedule cards support:
  - probable starters
  - lineups
  - weather
  - odds
  - composite recommendation
  - projected score + composite recommendation in the game-card header
  - visible team rating inputs used by the model

## Current Daily Workflow

1. Set `Live Slate Date`
2. Click `Fetch MLB Data`
   - refreshes team-level model ratings from MLB team stats
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
6. Export `Predictions`
7. Export `Results`

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
- `Comp Rec: ...`

When the composite recommendation is a total, the header includes the market and price, for example:

- `Comp Rec: OVER 8.5 -115`

## Grading / CSV Flow

`Predictions` export includes the grading fields used by the evaluator:

- recommendations for ML / RL / total
- edge percentages
- all market odds needed for ROI later
- `LookupKey` as the last column

`Results` export includes:

- `Date`
- `Away`
- `Home`
- `AwayScore`
- `HomeScore`
- `LookupKey`

These are consumed by `src/lib/modelEvaluation.ts`.

## Key Files

- `src/components/ScheduleAnalysis.tsx`
- `src/components/SingleGameControls.tsx`
- `src/components/SingleGameResults.tsx`
- `src/hooks/useMlbModelData.ts`
- `src/hooks/usePredictorState.ts`
- `src/lib/mlbApi.ts`
- `src/lib/teamRatings.ts`
- `src/lib/mlbModel.ts`
- `src/lib/modelEvaluation.ts`
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
