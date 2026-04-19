import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path

import pendulum
from airflow import DAG
from airflow.operators.python import PythonOperator


DEFAULT_WORKDIR = Path(__file__).resolve().parents[2]
WORKDIR = Path(os.environ.get("MLB_PREDICTOR_DIR", DEFAULT_WORKDIR))
ODDS_SOURCE = os.environ.get("MLB_ODDS_OVERRIDE_SOURCE", "betlotus-mlb")

local_tz = pendulum.timezone("America/Los_Angeles")


def npm_command():
    return "npm.cmd" if platform.system() == "Windows" else "npm"


def run_cli(args: list[str], **context):
    subprocess.run(
        [npm_command(), "run", "cli", "--", *args],
        cwd=str(WORKDIR),
        check=True,
    )


def fetch_team_stats(**context):
    run_cli(["fetch-team-stats", "--date", context["ds"]], **context)


def capture_odds_overrides(**context):
    run_cli(["capture-odds-overrides", "--date", context["ds"], "--source", ODDS_SOURCE], **context)


def approve_odds_overrides(**context):
    run_cli(["approve-odds-overrides", "--date", context["ds"], "--source", ODDS_SOURCE], **context)


def run_daily_pipeline(**context):
    run_cli([
        "run-daily-pipeline",
        "--date", context["ds"],
        "--use-odds-overrides",
        "--override-source", ODDS_SOURCE,
    ], **context)


with DAG(
    dag_id="mlb_daily_automation",
    start_date=datetime(2026, 4, 13, tzinfo=local_tz),
    schedule="0 9 * * *",
    catchup=False,
    tags=["mlb", "predictor", "automation"],
) as dag:
    t1 = PythonOperator(task_id="fetch_team_stats", python_callable=fetch_team_stats)
    t2 = PythonOperator(task_id="capture_odds_overrides", python_callable=capture_odds_overrides)
    t3 = PythonOperator(task_id="approve_odds_overrides", python_callable=approve_odds_overrides)
    t4 = PythonOperator(task_id="run_daily_pipeline", python_callable=run_daily_pipeline)

    t1 >> t2 >> t3 >> t4
