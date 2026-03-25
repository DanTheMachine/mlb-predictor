# MLB Predictor

MLB predictor app for the `game_sims` workspace.

## Stack

- React
- TypeScript
- Vite
- Vitest
- Playwright
- ESLint

## Current App

The MLB app is no longer a scaffold. It now includes:

- Predictor / Results Tracker / Model Eval tabs
- live MLB team-model refresh
- daily schedule loading
- live weather and ESPN odds integration
- bulk manual line editing
- single-game simulator tools
- prediction export and results export for grading

## Core Workflow

1. Select `Live Slate Date`
2. Click `Fetch MLB Data`
3. Click `Load Games`
4. Optionally use `Bulk Edit Lines`
5. Click `Run All Sims`
6. Export `Predictions`
7. Export `Results`

## Odds Behavior

The app supports three odds states:

- `ESPN live`
- `Manual`
- `Model default`

`Odds live` remains satisfied for both `ESPN live` and `Manual`.

`Market fallback active` means the game is still using `Model default` odds.

## Grading Files

`Predictions` export contains:

- model recommendations
- edge percentages
- moneyline / run line / total odds
- `LookupKey`

`Results` export contains:

- final scores
- `LookupKey`

These two files are intended to be used together in Model Eval for grading and ROI analysis.

## CI

GitHub Actions now runs automated CI for the MLB app on pushes to `main` / `master` and on pull requests.

The workflow runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
