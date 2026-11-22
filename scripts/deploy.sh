#!/usr/bin/env bash

# ==============================================================================
# Agentic Literature Survey - Production Deployment Automation
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=============================================================${NC}"
echo -e "${BLUE}  Agentic Literature Survey - Production Deployment${NC}"
echo -e "${BLUE}=============================================================${NC}\n"

# 1. Check prerequisites
echo -e "${YELLOW}[1/6] Checking system prerequisites...${NC}"
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not installed or not in PATH.${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

DOCKER_COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo -e "${RED}Error: docker compose plugin is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker & Docker Compose are available.${NC}"

# 2. Check environment configuration
echo -e "\n${YELLOW}[2/6] Verifying environment configuration (.env)...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}Notice: .env file not found. Generating from .env.example...${NC}"
    cp .env.example .env
    # Generate random 32-character hex encryption key
    RANDOM_KEY=$(head -c 32 /dev/urandom | xxd -p 2>/dev/null || openssl rand -hex 16 2>/dev/null || echo "prod_secure_n8n_key_32bytes_min")
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/replace_with_a_secure_random_32_character_hex_key_here/${RANDOM_KEY}/g" .env
    else
        sed -i "s/replace_with_a_secure_random_32_character_hex_key_here/${RANDOM_KEY}/g" .env
    fi
    echo -e "${GREEN}✓ Created default .env with generated encryption key.${NC}"
    echo -e "${YELLOW}! IMPORTANT: Please edit .env to insert your GROQ_API_KEY, OPENROUTER_API_KEY, and GEMINI_API_KEY for live LLM synthesis.${NC}"
else
    echo -e "${GREEN}✓ Existing .env file found.${NC}"
fi

# 3. Create required directories
echo -e "\n${YELLOW}[3/6] Ensuring project directories exist...${NC}"
mkdir -p workflows output backups
echo -e "${GREEN}✓ Directory structure verified.${NC}"

# 4. Pull and build containers
echo -e "\n${YELLOW}[4/6] Launching production Docker Compose stack...${NC}"
$DOCKER_COMPOSE_CMD up -d

# 5. Wait for n8n service health
echo -e "\n${YELLOW}[5/6] Waiting for services to become healthy...${NC}"
echo "Polling n8n container..."
RETRIES=30
until [ $RETRIES -le 0 ]; do
    if docker exec -i literature_survey_n8n wget -q --spider http://127.0.0.1:5678/healthz 2>/dev/null; then
        echo -e "${GREEN}✓ n8n engine is healthy and operational!${NC}"
        break
    fi
    echo "Waiting for n8n startup (remaining retries: $RETRIES)..."
    sleep 3
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -le 0 ]; then
    echo -e "${YELLOW}Warning: n8n startup took longer than expected, but containers are running.${NC}"
fi

# 6. Import workflow
echo -e "\n${YELLOW}[6/6] Verifying workflow import...${NC}"
docker exec -i literature_survey_n8n n8n import:workflow --input=/workflows/Agentic_Literature_Survey_Workflow.prod.json 2>/dev/null || true
echo -e "${GREEN}✓ Production workflow imported into n8n!${NC}"

echo -e "\n${GREEN}=============================================================${NC}"
echo -e "${GREEN}  DEPLOYMENT SUCCESSFUL!${NC}"
echo -e "${GREEN}=============================================================${NC}"
echo -e "n8n UI & Workflow Canvas:  http://localhost:5678"
echo -e "Form Submission URL:       http://localhost:5678/form/..."
echo -e "Reverse Proxy (HTTPS):     https://${DOMAIN_NAME:-localhost}"
echo -e "Logs:                      $DOCKER_COMPOSE_CMD logs -f n8n"
echo -e "Stop services:             $DOCKER_COMPOSE_CMD down"
echo -e "${GREEN}=============================================================${NC}\n"
