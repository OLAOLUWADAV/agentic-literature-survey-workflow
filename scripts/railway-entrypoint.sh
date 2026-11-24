#!/bin/sh
set -e

# ── Map Railway PostgreSQL plugin vars to n8n's expected vars ──────────────
if [ -n "$PGHOST" ]; then
  export DB_TYPE=postgresdb
  export DB_POSTGRESDB_HOST="$PGHOST"
  export DB_POSTGRESDB_PORT="${PGPORT:-5432}"
  export DB_POSTGRESDB_DATABASE="$PGDATABASE"
  export DB_POSTGRESDB_USER="$PGUSER"
  export DB_POSTGRESDB_PASSWORD="$PGPASSWORD"
fi

# ── Set Railway public domain for webhooks ─────────────────────────────────
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
  export WEBHOOK_URL="https://$RAILWAY_PUBLIC_DOMAIN"
  export N8N_HOST="$RAILWAY_PUBLIC_DOMAIN"
  export N8N_PROTOCOL="https"
fi

# ── Port assignment ────────────────────────────────────────────────────────
# Railway exposes exactly one PORT. The runner web server takes that port so
# the survey UI is reachable. n8n runs on a fixed internal port (5678).
export RUNNER_PORT="${PORT:-3000}"
export N8N_PORT=5678

echo "Starting n8n on internal port $N8N_PORT..."
N8N_PORT=$N8N_PORT n8n start &
N8N_PID=$!

echo "Waiting for n8n to initialise..."
sleep 20

echo "Importing production workflow..."
n8n import:workflow --input=/workflows/Agentic_Literature_Survey_Workflow.prod.json || true
echo "Workflow import done."

echo "Starting runner server on port $RUNNER_PORT..."
# Pass n8n's internal URL so the runner can proxy webhook calls if needed
export N8N_INTERNAL_URL="http://localhost:$N8N_PORT"
PORT=$RUNNER_PORT node /home/node/runner/server.js &
RUNNER_PID=$!

echo "All services started. runner=$RUNNER_PID n8n=$N8N_PID"

# If either process exits, bring everything down so Railway restarts the dyno
wait_any() {
  while kill -0 "$N8N_PID" 2>/dev/null && kill -0 "$RUNNER_PID" 2>/dev/null; do
    sleep 5
  done
}
wait_any

echo "A service exited — shutting down."
kill "$N8N_PID" "$RUNNER_PID" 2>/dev/null || true
exit 1
