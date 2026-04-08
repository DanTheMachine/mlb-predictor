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
    macros = context["macros"]
    command_args = {
        "refresh_team_stats": ["fetch-team-stats", "--date", ds],
        "load_slate": ["load-slate", "--date", ds],
        "generate_predictions": ["run-predictions", "--date", ds],
        "export_predictions_csv": ["export-predictions-csv", "--date", ds],
        "ingest_yesterday_results": ["ingest-results", "--date", macros.ds_add(ds, -1)],
        "export_results_csv": ["export-results-csv", "--date", macros.ds_add(ds, -1)],
        "evaluate_model": ["evaluate", "--from", macros.ds_add(ds, -30), "--to", macros.ds_add(ds, -1)],
    }[command]

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
    fetch_team_stats = PythonOperator(
        task_id="refresh_team_stats",
        python_callable=run_cli,
        op_kwargs={"command": "refresh_team_stats"},
    )

    load_slate = PythonOperator(
        task_id="load_slate",
        python_callable=run_cli,
        op_kwargs={"command": "load_slate"},
    )

    run_predictions = PythonOperator(
        task_id="generate_predictions",
        python_callable=run_cli,
        op_kwargs={"command": "generate_predictions"},
    )

    export_predictions = PythonOperator(
        task_id="export_predictions_csv",
        python_callable=run_cli,
        op_kwargs={"command": "export_predictions_csv"},
    )

    ingest_results = PythonOperator(
        task_id="ingest_yesterday_results",
        python_callable=run_cli,
        op_kwargs={"command": "ingest_yesterday_results"},
    )

    export_results = PythonOperator(
        task_id="export_results_csv",
        python_callable=run_cli,
        op_kwargs={"command": "export_results_csv"},
    )

    evaluate_model = PythonOperator(
        task_id="evaluate_model",
        python_callable=run_cli,
        op_kwargs={"command": "evaluate_model"},
    )

    fetch_team_stats >> load_slate >> run_predictions >> export_predictions
    export_predictions >> ingest_results >> export_results >> evaluate_model
