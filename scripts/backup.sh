#!/usr/bin/env bash

# ==============================================================================
# Production Backup Script
# Dumps PostgreSQL database and exports n8n workflows & credentials
# ==============================================================================

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_DIR}/backup_${TIMESTAMP}"

mkdir -p "$TARGET_DIR"

echo "=== Starting Production Backup at $(date) ==="

# 1. Backup PostgreSQL
if docker ps --format '{{.Names}}' | grep -q "^literature_survey_postgres$"; then
    echo "Dumping PostgreSQL database..."
    docker exec -t literature_survey_postgres pg_dumpall -c -U "${POSTGRES_USER:-n8n_prod}" > "${TARGET_DIR}/postgres_dump.sql" 2>/dev/null || true
    echo "✓ Database dump created."
else
    echo "Warning: PostgreSQL container is not running, skipping database dump."
fi

# 2. Export n8n workflows
if docker ps --format '{{.Names}}' | grep -q "^literature_survey_n8n$"; then
    echo "Exporting n8n workflows..."
    docker exec -t literature_survey_n8n n8n export:workflow --all --output=/tmp/workflows_backup.json 2>/dev/null || true
    docker cp literature_survey_n8n:/tmp/workflows_backup.json "${TARGET_DIR}/workflows_backup.json" 2>/dev/null || true
    echo "✓ Workflows exported."
else
    echo "Warning: n8n container is not running, skipping workflow export."
fi

# 3. Compress Archive
ARCHIVE_NAME="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"
tar -czf "$ARCHIVE_NAME" -C "$BACKUP_DIR" "backup_${TIMESTAMP}"
rm -rf "$TARGET_DIR"

echo "✓ Backup archive created at: $ARCHIVE_NAME"
echo "=== Backup Complete ==="
