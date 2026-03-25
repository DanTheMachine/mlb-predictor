# Running The MLB Model

## Install

```bash
npm install
```

## Start The Proxy

The MLB app uses a local proxy for:

- MLB schedule and probable starters
- MLB lineup checks
- MLB team stats used for model refresh
- weather
- ESPN odds

Run this from `C:\projects\game_sims\mlb_predictor` in a separate terminal:

```bash
npm run proxy
```

The proxy listens on `http://localhost:8787`.

## Start The App

```bash
npm run dev
```

Recommended startup order:

1. `npm run proxy`
2. `npm run dev`
3. Open the MLB predictor UI

## Normal Predictor Workflow

1. Set `Live Slate Date`
2. Click `Fetch MLB Data`
   - refreshes team-level ratings used by the model
3. Click `Load Games`
   - loads the slate
   - loads lineups
   - loads weather
   - loads ESPN odds when available
4. Optionally use `Bulk Edit Lines`
   - pasted lines become active `Manual` odds
5. Click `Run All Sims`
6. Export `Predictions`
7. Export `Results`

## Notes

- `Load Sample Slate` does not require the proxy.
- `Bulk Edit Lines` does not require the proxy.
- `Fetch MLB Data` and `Load Games` do require the proxy.
- `Results` exports the previous day’s completed MLB results.
- `Odds live` counts both `ESPN live` and `Manual` odds.
- `Market fallback active` means the card is still using model-generated default odds.

## Validation Commands

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

## CI

GitHub Actions now runs the same core checks in CI from `.github/workflows/ci.yml`:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
