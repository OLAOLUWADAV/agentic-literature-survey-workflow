.PHONY: help deploy deploy-local import backup health start-runner survey down logs

help:
	@echo "Available commands:"
	@echo "  make deploy        - Deploy full production stack (n8n + PostgreSQL + Caddy SSL)"
	@echo "  make deploy-local  - Deploy lightweight local stack on port 5678"
	@echo "  make import        - Auto-import and activate production workflow in n8n"
	@echo "  make backup        - Backup PostgreSQL database and exported n8n workflows"
	@echo "  make health        - Check production container and endpoint health"
	@echo "  make start-runner  - Launch standalone REST API & Web Dashboard on port 3000"
	@echo "  make survey        - Run CLI survey (usage: make survey TOPIC=\"Your Topic\")"
	@echo "  make down          - Stop all production containers"
	@echo "  make logs          - Stream live n8n container logs"

deploy:
	bash scripts/deploy.sh

deploy-local:
	docker compose -f docker-compose.local.yml up -d

import:
	bash scripts/import_workflow.sh

backup:
	bash scripts/backup.sh

health:
	bash scripts/healthcheck.sh

start-runner:
	node runner/server.js

survey:
	node runner/cli.js "$(TOPIC)"

down:
	docker compose down

logs:
	docker compose logs -f n8n
