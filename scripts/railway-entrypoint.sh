#!/bin/sh
set -e

# Map Railway PostgreSQL plugin vars to n8n's expected vars
if [ -n "$PGHOST" ]; then
  export DB_TYPE=postgresdb
  export DB_POSTGRESDB_HOST="$PGHOST"
  export DB_POSTGRESDB_PORT="${PGPORT:-5432}"
  export DB_POSTGRESDB_DATABASE="$PGDATABASE"
  export DB_POSTGRESDB_USER="$PGUSER"
  export DB_POSTGRESDB_PASSWORD="$PGPASSWORD"
fi

# Set Railway public domain for webhooks
if [ -n "$RAILWAY_PUBLIC_DOMAIN" ]; then
  export WEBHOOK_URL="https://$RAILWAY_PUBLIC_DOMAIN"
  export N8N_HOST="$RAILWAY_PUBLIC_DOMAIN"
  export N8N_PROTOCOL="https"
fi

# Railway sets PORT — map to n8n
export N8N_PORT="${PORT:-5678}"

# Start n8n in background, import workflow, then foreground
n8n start &
N8N_PID=$!

echo "Waiting for n8n to be ready..."
sleep 20

echo "Importing production workflow..."
n8n import:workflow --input=/workflows/Agentic_Literature_Survey_Workflow.prod.json || true
echo "Workflow import done."

wait $N8N_PID
