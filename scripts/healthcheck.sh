#!/usr/bin/env bash

# ==============================================================================
# Production Healthcheck Script
# ==============================================================================

echo "=== Literature Survey Production Status ==="

# 1. Containers check
echo -e "\n1. Container Status:"
docker ps --filter "name=literature_survey" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker daemon not reachable"

# 2. n8n API check
echo -e "\n2. n8n Engine Health:"
if curl -s -f http://127.0.0.1:5678/healthz >/dev/null 2>&1; then
    echo "✓ n8n engine is healthy (http://localhost:5678)"
else
    echo "✗ n8n engine is not responding on http://localhost:5678"
fi

# 3. Standalone Runner API check
echo -e "\n3. Standalone Runner API Health:"
if curl -s -f http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✓ Standalone Runner is healthy (http://localhost:3000)"
else
    echo "- Standalone Runner not running on port 3000 (optional service)"
fi

echo -e "\n=== Status Check Complete ==="
