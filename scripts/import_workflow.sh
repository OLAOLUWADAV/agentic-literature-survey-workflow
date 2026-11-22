#!/usr/bin/env bash

# ==============================================================================
# Workflow Import & Activation Script
# ==============================================================================

set -e

CONTAINER_NAME="literature_survey_n8n"
WORKFLOW_FILE="/workflows/Agentic_Literature_Survey_Workflow.prod.json"

echo "Checking if container $CONTAINER_NAME is running..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container $CONTAINER_NAME is not currently running."
    echo "Start containers first using: docker compose up -d"
    exit 1
fi

echo "Importing production workflow from $WORKFLOW_FILE into $CONTAINER_NAME..."
docker exec -i "$CONTAINER_NAME" n8n import:workflow --input="$WORKFLOW_FILE"

echo "Listing installed workflows in n8n..."
docker exec -i "$CONTAINER_NAME" n8n list:workflow

echo "Done! Workflow is imported and ready to run."
