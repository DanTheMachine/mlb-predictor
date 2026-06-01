#!/usr/bin/env python3
"""
Apply trained residual models to a batch of feature vectors.

Called by residualCorrection.ts via child_process. Reads JSON from stdin,
writes JSON to stdout. Exits non-zero on any failure so TypeScript can detect
and fall back gracefully.

Stdin format:
  {
    "modelDir": "./models",
    "games": [
      { "lookupKey": "...", "features": { "ProjectedHomeRuns": 4.5, ... } },
      ...
    ]
  }

Stdout format:
  [
    { "lookupKey": "...", "deltaHome": 0.12, "deltaAway": -0.08 },
    ...
  ]
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

CATEGORICAL_MAPPINGS = {
    "WindDirection": {"Out": 1.0, "In": -1.0, "Cross": 0.5, "Neutral": 0.0},
    "HomeBullpenFatigue": {"Fresh": 0.0, "Used": 1.0, "Taxed": 2.0},
    "AwayBullpenFatigue": {"Fresh": 0.0, "Used": 1.0, "Taxed": 2.0},
    "HomeLineupConfidence": {"Confirmed": 1.0, "Projected": 0.5, "Thin": 0.0},
    "AwayLineupConfidence": {"Confirmed": 1.0, "Projected": 0.5, "Thin": 0.0},
}

MAX_DELTA = 3.0  # clamp corrections to ±3 runs — guards against bad artifacts


def encode_features(raw: dict) -> dict:
    encoded = {}
    for k, v in raw.items():
        if k in CATEGORICAL_MAPPINGS:
            encoded[k] = CATEGORICAL_MAPPINGS[k].get(str(v), 0.0) if v is not None else 0.0
        else:
            encoded[k] = float(v) if v is not None else 0.0
    return encoded


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as e:
        print(f"[predict_residual] Failed to parse stdin: {e}", file=sys.stderr)
        sys.exit(1)

    model_dir = Path(payload.get("modelDir", "./models"))
    home_path = model_dir / "residual_home.json"
    away_path = model_dir / "residual_away.json"

    if not home_path.exists() or not away_path.exists():
        print(f"[predict_residual] Model artifacts not found in {model_dir}", file=sys.stderr)
        sys.exit(1)

    model_home = xgb.XGBRegressor()
    model_away = xgb.XGBRegressor()
    try:
        model_home.load_model(str(home_path))
        model_away.load_model(str(away_path))
    except Exception as e:
        print(f"[predict_residual] Failed to load model artifacts: {e}", file=sys.stderr)
        sys.exit(1)

    games = payload.get("games", [])
    if not games:
        print(json.dumps([]))
        return

    lookup_keys = [g["lookupKey"] for g in games]
    rows = [encode_features(g["features"]) for g in games]
    df = pd.DataFrame(rows)

    # Ensure feature columns match training order from metadata if present
    metadata_path = model_dir / "model_metadata.json"
    if metadata_path.exists():
        try:
            meta = json.loads(metadata_path.read_text())
            expected_cols = meta.get("features", [])
            for col in expected_cols:
                if col not in df.columns:
                    df[col] = 0.0
            df = df[expected_cols]
        except Exception:
            pass  # proceed with available columns

    try:
        delta_home = model_home.predict(df)
        delta_away = model_away.predict(df)
    except Exception as e:
        print(f"[predict_residual] Prediction failed: {e}", file=sys.stderr)
        sys.exit(1)

    results = [
        {
            "lookupKey": key,
            "deltaHome": round(clamp(float(dh), -MAX_DELTA, MAX_DELTA), 4),
            "deltaAway": round(clamp(float(da), -MAX_DELTA, MAX_DELTA), 4),
        }
        for key, dh, da in zip(lookup_keys, delta_home, delta_away)
    ]

    print(json.dumps(results))


if __name__ == "__main__":
    main()
