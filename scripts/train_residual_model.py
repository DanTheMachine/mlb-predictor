#!/usr/bin/env python3
"""
Train residual correction models for home and away run projections.

Usage:
    python scripts/train_residual_model.py --input ./generated/residuals.csv [--model-dir ./models]

Outputs to <model-dir>/:
    archive/<YYYY-MM-DD>/residual_home.json
    archive/<YYYY-MM-DD>/residual_away.json
    archive/<YYYY-MM-DD>/model_metadata.json
    archive/<YYYY-MM-DD>/shap_home.json
    archive/<YYYY-MM-DD>/shap_away.json

Promotes to models/ top-level only if corrected MAE beats the analytical baseline.
"""

import argparse
import json
import sys
import os
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.model_selection import KFold
from sklearn.metrics import mean_absolute_error

MIN_ROWS = 200
EXTREME_TOTAL = 25
CV_FOLDS = 5

NUMERIC_FEATURES = [
    "ProjectedHomeRuns",
    "ProjectedAwayRuns",
    "HomeStarterEra",
    "HomeStarterFip",
    "AwayStarterEra",
    "AwayStarterFip",
    "Temperature",
    "WindMph",
    "ParkFactor",
    "MarketTotal",
    "MonthOfSeason",
    # DayOfWeek excluded: high cardinality (7 values) causes overfitting at <800 rows.
    # Re-enable once training set exceeds 800 clean rows.
]

CATEGORICAL_FEATURES = {
    "WindDirection": {"Out": 1.0, "In": -1.0, "Cross": 0.5, "Neutral": 0.0},
    "HomeBullpenFatigue": {"Fresh": 0.0, "Used": 1.0, "Taxed": 2.0},
    "AwayBullpenFatigue": {"Fresh": 0.0, "Used": 1.0, "Taxed": 2.0},
    "HomeLineupConfidence": {"Confirmed": 1.0, "Projected": 0.5, "Thin": 0.0},
    "AwayLineupConfidence": {"Confirmed": 1.0, "Projected": 0.5, "Thin": 0.0},
}


def load_and_clean(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    # Drop obvious incomplete games
    df = df[(df["ActualHomeRuns"] + df["ActualAwayRuns"]) >= 5].copy()

    # Drop extreme outliers from training (flag but don't crash)
    extreme = df[(df["ActualHomeRuns"] + df["ActualAwayRuns"]) >= EXTREME_TOTAL]
    if len(extreme) > 0:
        print(f"[train] Excluding {len(extreme)} extreme-total rows (>= {EXTREME_TOTAL} combined runs) from training.")
    df = df[(df["ActualHomeRuns"] + df["ActualAwayRuns"]) < EXTREME_TOTAL].copy()

    # Drop rows where all contextual features are null — these are predictions that were
    # stored before slate context was saved. Median-imputing an all-null row produces a
    # fake data point at the median of every feature, which dilutes the signal.
    context_features = [
        "Temperature", "WindMph", "ParkFactor",
        "HomeStarterEra", "HomeStarterFip", "AwayStarterEra", "AwayStarterFip",
    ]
    available_context = [c for c in context_features if c in df.columns]
    if available_context:
        before = len(df)
        df = df[df[available_context].notnull().any(axis=1)].copy()
        dropped = before - len(df)
        if dropped > 0:
            print(f"[train] Dropped {dropped} rows with no contextual feature data (all-null slate context).")

    # Encode categoricals
    for col, mapping in CATEGORICAL_FEATURES.items():
        if col in df.columns:
            df[col] = df[col].map(mapping).fillna(0.0)

    # Fill remaining numeric nulls with column median (partial nulls are OK)
    null_counts = {}
    for col in NUMERIC_FEATURES:
        if col in df.columns:
            n_null = df[col].isna().sum()
            if n_null > 0:
                null_counts[col] = int(n_null)
                df[col] = df[col].fillna(df[col].median())

    if null_counts:
        print(f"[train] Filled partial null values: {null_counts}")

    total_excluded_pct = (len(extreme)) / max(len(df) + len(extreme), 1) * 100
    if total_excluded_pct > 30:
        print(
            f"[train] WARNING: {total_excluded_pct:.1f}% of rows excluded. "
            "Check data quality before trusting this model."
        )
        sys.exit(1)

    return df


def build_feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    all_features = NUMERIC_FEATURES + list(CATEGORICAL_FEATURES.keys())
    available = [c for c in all_features if c in df.columns]
    return df[available].copy()


def train_model(X_train, y_train):
    model = xgb.XGBRegressor(
        n_estimators=200,
        max_depth=3,          # shallower trees — reduces overfitting at <800 rows
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.7,
        min_child_weight=5,   # require more samples per leaf
        reg_lambda=2.0,       # L2 regularization
        reg_alpha=0.1,        # L1 regularization
        random_state=42,
        verbosity=0,
    )
    model.fit(X_train, y_train)
    return model


def compute_shap(model, X: pd.DataFrame) -> dict:
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    mean_abs = np.abs(shap_values).mean(axis=0)
    return {col: float(val) for col, val in zip(X.columns, mean_abs)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to residuals CSV from export-residuals")
    parser.add_argument("--model-dir", default="./models", help="Directory for model artifacts")
    args = parser.parse_args()

    df = load_and_clean(args.input)

    if len(df) < MIN_ROWS:
        print(
            f"[train] ERROR: only {len(df)} clean rows available (minimum {MIN_ROWS}). "
            "Accumulate more graded games before training."
        )
        sys.exit(1)

    print(f"[train] Training on {len(df)} rows after cleaning.")

    X = build_feature_matrix(df)
    y_home = df["ResidualHome"]
    y_away = df["ResidualAway"]

    # --- 5-fold cross-validation for reliable MAE estimate ---
    # With ~400 rows a single held-out of 59 has high variance (±0.15 runs).
    # CV uses every row for evaluation and averages across 5 folds.
    kf = KFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    cv_home_corrected, cv_home_baseline = [], []
    cv_away_corrected, cv_away_baseline = [], []

    for fold_train_idx, fold_val_idx in kf.split(X):
        X_fold_train, X_fold_val = X.iloc[fold_train_idx], X.iloc[fold_val_idx]
        yh_train, yh_val = y_home.iloc[fold_train_idx], y_home.iloc[fold_val_idx]
        ya_train, ya_val = y_away.iloc[fold_train_idx], y_away.iloc[fold_val_idx]

        m_home = train_model(X_fold_train, yh_train)
        m_away = train_model(X_fold_train, ya_train)

        cv_home_corrected.append(mean_absolute_error(yh_val, m_home.predict(X_fold_val)))
        cv_home_baseline.append(mean_absolute_error(yh_val, np.zeros(len(yh_val))))
        cv_away_corrected.append(mean_absolute_error(ya_val, m_away.predict(X_fold_val)))
        cv_away_baseline.append(mean_absolute_error(ya_val, np.zeros(len(ya_val))))

    corrected_mae_home = float(np.mean(cv_home_corrected))
    corrected_mae_away = float(np.mean(cv_away_corrected))
    baseline_mae_home  = float(np.mean(cv_home_baseline))
    baseline_mae_away  = float(np.mean(cv_away_baseline))

    print(f"[train] {CV_FOLDS}-fold CV MAE — home: corrected={corrected_mae_home:.3f}, baseline={baseline_mae_home:.3f}")
    print(f"[train] {CV_FOLDS}-fold CV MAE — away: corrected={corrected_mae_away:.3f}, baseline={baseline_mae_away:.3f}")

    # Train final models on the full dataset for deployment
    print(f"[train] Training final models on all {len(X)} rows.")
    model_home = train_model(X, y_home)
    model_away = train_model(X, y_away)

    # SHAP importances on a random 20% sample (fast, representative)
    shap_sample = X.sample(frac=0.2, random_state=42)
    shap_home = compute_shap(model_home, shap_sample)
    shap_away = compute_shap(model_away, shap_sample)

    version = date.today().isoformat()
    model_dir = Path(args.model_dir)
    archive_dir = model_dir / "archive" / version
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Save artifacts to archive
    model_home.save_model(str(archive_dir / "residual_home.json"))
    model_away.save_model(str(archive_dir / "residual_away.json"))

    metadata = {
        "modelVersion": version,
        "trainingFromDate": str(df["Date"].min()),
        "trainingToDate": str(df["Date"].max()),
        "trainingRowCount": len(df),
        "cvFolds": CV_FOLDS,
        "cvMAE_home": round(corrected_mae_home, 4),
        "cvMAE_away": round(corrected_mae_away, 4),
        "analyticalBaselineMAE_home": round(baseline_mae_home, 4),
        "analyticalBaselineMAE_away": round(baseline_mae_away, 4),
        "trainedAt": datetime.utcnow().isoformat() + "Z",
        "features": list(X.columns),
    }
    (archive_dir / "model_metadata.json").write_text(json.dumps(metadata, indent=2))
    (archive_dir / "shap_home.json").write_text(json.dumps(shap_home, indent=2))
    (archive_dir / "shap_away.json").write_text(json.dumps(shap_away, indent=2))

    print(f"[train] Artifacts saved to {archive_dir}")

    # Promotion gate: average combined MAE must improve AND neither side may degrade
    # by more than 0.08 runs (guards against a strong home improvement masking a bad away model).
    MAX_SIDE_DEGRADATION = 0.08
    avg_corrected = (corrected_mae_home + corrected_mae_away) / 2
    avg_baseline = (baseline_mae_home + baseline_mae_away) / 2
    avg_improved = avg_corrected < avg_baseline
    home_degradation = max(0.0, corrected_mae_home - baseline_mae_home)
    away_degradation = max(0.0, corrected_mae_away - baseline_mae_away)
    degradation_ok = home_degradation <= MAX_SIDE_DEGRADATION and away_degradation <= MAX_SIDE_DEGRADATION

    print(f"[train] Avg CV MAE — corrected={avg_corrected:.3f}, baseline={avg_baseline:.3f}")
    print(f"[train] Side degradation — home={home_degradation:.3f}, away={away_degradation:.3f} (cap={MAX_SIDE_DEGRADATION})")

    if avg_improved and degradation_ok:
        import shutil
        for fname in ["residual_home.json", "residual_away.json", "model_metadata.json"]:
            shutil.copy2(archive_dir / fname, model_dir / fname)
        print(f"[train] Promoted to {model_dir} (avg MAE improved, degradation within cap).")
    else:
        reason = []
        if not avg_improved:
            reason.append(f"avg MAE did not improve ({avg_corrected:.3f} vs baseline {avg_baseline:.3f})")
        if not degradation_ok:
            reason.append(f"side degradation exceeded cap (home={home_degradation:.3f}, away={away_degradation:.3f})")
        print(f"[train] NOT promoted: {'; '.join(reason)}. Archived at {archive_dir}.")
        sys.exit(2)


if __name__ == "__main__":
    main()
