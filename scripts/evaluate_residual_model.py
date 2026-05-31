#!/usr/bin/env python3
"""
Compare analytical vs residual-corrected accuracy on a held-out date window.

Usage:
    python scripts/evaluate_residual_model.py \
        --residuals ./generated/residuals.csv \
        --corrections ./generated/corrections.csv \
        [--from YYYY-MM-DD] [--to YYYY-MM-DD]

The corrections CSV is produced by `npm run cli -- export-residuals` after
`apply-residual-corrections` has run. It should contain:
    LookupKey, Date, CorrectedHomeRuns, CorrectedAwayRuns,
    ActualHomeRuns, ActualAwayRuns, ProjectedHomeRuns, ProjectedAwayRuns

Exits non-zero (code 2) if corrected MAE exceeds analytical MAE on either side,
signalling that the model is hurting rather than helping.
"""

import argparse
import json
import sys

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, brier_score_loss


def load_residuals(path: str, from_date: str | None, to_date: str | None) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"])
    if from_date:
        df = df[df["Date"] >= pd.to_datetime(from_date)]
    if to_date:
        df = df[df["Date"] <= pd.to_datetime(to_date)]
    return df


def load_corrections(path: str, from_date: str | None, to_date: str | None) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["Date"] = pd.to_datetime(df["Date"])
    if from_date:
        df = df[df["Date"] >= pd.to_datetime(from_date)]
    if to_date:
        df = df[df["Date"] <= pd.to_datetime(to_date)]
    return df


def win_prob_from_margin(margin: pd.Series, sigma: float = 1.9) -> pd.Series:
    """Logistic approximation matching predictGame() win probability."""
    return 1 / (1 + np.exp(-(margin / sigma)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--residuals", required=True, help="Path to residuals CSV (from export-residuals)")
    parser.add_argument("--corrections", required=True, help="Path to corrections CSV (from export-corrections)")
    parser.add_argument("--from", dest="from_date", default=None)
    parser.add_argument("--to", dest="to_date", default=None)
    args = parser.parse_args()

    residuals = load_residuals(args.residuals, args.from_date, args.to_date)
    corrections = load_corrections(args.corrections, args.from_date, args.to_date)

    merged = residuals.merge(corrections[["LookupKey", "CorrectedHomeRuns", "CorrectedAwayRuns"]], on="LookupKey", how="inner")

    if len(merged) == 0:
        print("[evaluate] No matching rows between residuals and corrections. Check date range and LookupKey alignment.")
        sys.exit(1)

    print(f"[evaluate] Evaluating {len(merged)} matched games.")

    actual_home = merged["ActualHomeRuns"]
    actual_away = merged["ActualAwayRuns"]
    proj_home = merged["ProjectedHomeRuns"]
    proj_away = merged["ProjectedAwayRuns"]
    corr_home = merged["CorrectedHomeRuns"]
    corr_away = merged["CorrectedAwayRuns"]

    # MAE
    analytical_mae_home = mean_absolute_error(actual_home, proj_home)
    analytical_mae_away = mean_absolute_error(actual_away, proj_away)
    corrected_mae_home = mean_absolute_error(actual_home, corr_home)
    corrected_mae_away = mean_absolute_error(actual_away, corr_away)

    # Brier score on win probability (home wins actual vs projected)
    actual_home_win = (actual_home > actual_away).astype(float)
    analytical_margin = proj_home - proj_away
    corrected_margin = corr_home - corr_away
    analytical_win_prob = win_prob_from_margin(analytical_margin)
    corrected_win_prob = win_prob_from_margin(corrected_margin)
    analytical_brier = brier_score_loss(actual_home_win, analytical_win_prob)
    corrected_brier = brier_score_loss(actual_home_win, corrected_win_prob)

    # Team-level bias
    home_bias = (merged["ActualHomeRuns"] - merged["ProjectedHomeRuns"]).groupby(merged["HomeTeam"]).mean()
    home_bias_top = home_bias.abs().nlargest(5).to_dict()

    report = {
        "rows": int(len(merged)),
        "analyticalMAE": {
            "home": round(analytical_mae_home, 4),
            "away": round(analytical_mae_away, 4),
        },
        "correctedMAE": {
            "home": round(corrected_mae_home, 4),
            "away": round(corrected_mae_away, 4),
        },
        "analyticalBrierScore": round(analytical_brier, 4),
        "correctedBrierScore": round(corrected_brier, 4),
        "homeImproved": corrected_mae_home < analytical_mae_home,
        "awayImproved": corrected_mae_away < analytical_mae_away,
        "brierImproved": corrected_brier < analytical_brier,
        "largestTeamBiases": {k: round(v, 3) for k, v in home_bias_top.items()},
    }

    print(json.dumps(report, indent=2))

    both_improved = report["homeImproved"] and report["awayImproved"]
    if not both_improved:
        print(
            "\n[evaluate] WARNING: corrected MAE does not improve on analytical baseline on at least one side. "
            "Consider rolling back or retraining.",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
