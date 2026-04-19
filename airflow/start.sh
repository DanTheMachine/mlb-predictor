#!/bin/bash
# Starts the MLB predictor proxy and Airflow scheduler + webserver.
# Run once each morning before 9 AM, or keep running persistently.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export AIRFLOW_HOME="$REPO_DIR/airflow"
export AIRFLOW__CORE__EXECUTOR=LocalExecutor
export AIRFLOW__CORE__MP_START_METHOD=fork
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

AIRFLOW="$HOME/opt/miniconda3/envs/airflow-env/bin/airflow"
if [ ! -f "$AIRFLOW" ]; then
  AIRFLOW="/opt/miniconda3/envs/airflow-env/bin/airflow"
fi

echo "==> Starting MLB proxy..."
cd "$REPO_DIR"
npm run proxy &
PROXY_PID=$!
echo "    proxy PID: $PROXY_PID"

echo "==> Starting Airflow scheduler..."
AIRFLOW_HOME="$AIRFLOW_HOME" AIRFLOW__CORE__EXECUTOR=LocalExecutor "$AIRFLOW" scheduler &
SCHEDULER_PID=$!
echo "    scheduler PID: $SCHEDULER_PID"

echo "==> Starting Airflow webserver on :8080..."
AIRFLOW_HOME="$AIRFLOW_HOME" "$AIRFLOW" webserver --port 8080 &
WEBSERVER_PID=$!
echo "    webserver PID: $WEBSERVER_PID"

echo ""
echo "All services running. Press Ctrl+C to stop all."

# Prevent Mac from sleeping while services are running
caffeinate -i &
CAFFEINATE_PID=$!

trap "echo 'Stopping...'; kill $PROXY_PID $SCHEDULER_PID $WEBSERVER_PID $CAFFEINATE_PID 2>/dev/null" INT TERM

wait
