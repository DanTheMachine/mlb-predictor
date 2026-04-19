#!/bin/bash
# Daily MLB pipeline runner — called by launchd at 9 AM.
# Starts the proxy if not running, then executes the full pipeline.

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG_DIR="$REPO_DIR/airflow/logs/pipeline"
LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$LOG_DIR"

exec >> "$LOG_FILE" 2>&1
echo "===== MLB Pipeline starting at $(date) ====="

# Start proxy if not already running
if ! curl -s http://localhost:8787/health > /dev/null 2>&1; then
  echo "Starting proxy..."
  cd "$REPO_DIR"
  npm run proxy &
  sleep 5
else
  echo "Proxy already running."
fi

# Run the full pipeline
echo "Running pipeline for $DATE..."
cd "$REPO_DIR"
npm run cli -- run-daily-pipeline \
  --date "$DATE" \
  --use-odds-overrides \
  --override-source betlotus-mlb

echo "===== Pipeline finished at $(date) ====="
