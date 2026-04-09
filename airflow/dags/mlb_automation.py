import os
import platform
import subprocess
from datetime import datetime
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator


DEFAULT_WORKDIR = Path(__file__).resolve().parents[2]
WORKDIR = Path(os.environ.get("MLB_PREDICTOR_DIR", DEFAULT_WORKDIR))


def npm_command():
    return "npm.cmd" if platform.system() == "Windows" else "npm"


def run_cli(command: str, **context):
    ds = context["ds"]
    use_overrides = os.environ.get("MLB_USE_ODDS_OVERRIDES", "").lower() in {"1", "true", "yes", "on"}
    override_source = os.environ.get("MLB_ODDS_OVERRIDE_SOURCE", "").strip()
    command_args = {
        "run_daily_pipeline": ["run-daily-pipeline", "--date", ds],
    }[command]

    if use_overrides:
        command_args.append("--use-odds-overrides")
    if override_source:
        command_args.extend(["--override-source", override_source])

    subprocess.run(
        [npm_command(), "run", "cli", "--", *command_args],
        cwd=str(WORKDIR),
        check=True,
    )


with DAG(
    dag_id="mlb_daily_automation",
    start_date=datetime(2026, 3, 31),
    schedule="0 8 * * *",
    catchup=False,
    tags=["mlb", "predictor", "automation"],
) as dag:
    run_daily_pipeline = PythonOperator(
        task_id="run_daily_pipeline",
        python_callable=run_cli,
        op_kwargs={"command": "run_daily_pipeline"},
    )
