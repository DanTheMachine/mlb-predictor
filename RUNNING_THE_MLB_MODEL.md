# Running The MLB Model

## Install

```bash
npm install
```

## Start The Proxy For Live Data

The MLB app now uses a local proxy for live schedule, probable starters, weather, lineup confirmation, and ESPN odds.

Run this in a separate terminal from the MLB app folder:

```bash
npm run proxy
```

The proxy listens on `http://localhost:8787`.

If you only want to use manual/sample workflows, the proxy is optional. If you want `Load Live Slate` or `Refresh Live Slate` to work, start the proxy first.

## Start Dev Server

```bash
npm run dev
```

With both processes running:

1. Start the proxy with `npm run proxy`
2. Start the app with `npm run dev`
3. Open the MLB predictor UI
4. Use `Load Live Slate` to pull live schedule data

If live loading fails, the first thing to check is whether the proxy terminal is running cleanly.

## Run Typecheck

```bash
npm run typecheck
```

## Run Tests

```bash
npm run test
```

## Run E2E

```bash
npm run test:e2e
```

## Quick Notes

- `Load Sample Slate` does not require the proxy.
- `Import Pasted Odds` does not require the proxy.
- Live slate features do require the proxy.
