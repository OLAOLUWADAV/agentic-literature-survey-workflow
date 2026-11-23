# Installation Guide

Three installation paths are available. Choose based on your situation:

| Path | Best for | Time | Requirements |
|------|---------|------|-------------|
| Docker Compose | Teams, production, all features | 15 min | Docker Desktop |
| Manual n8n | Existing n8n instance | 10 min | n8n already running |
| Quick demo (Ollama) | Researchers, no API key | 20 min | Ollama installed |

---

## Path 1: Docker Compose (Recommended)

Installs n8n, PostgreSQL, and the PDF extraction service. Ollama is optional.

### Prerequisites
- Docker Desktop 4.x or Docker Engine 24.x + Compose v2
- 4 GB RAM minimum (8 GB recommended if using Ollama)
- Ports 5678 (n8n) available on localhost

### Steps

**1. Clone the repository**
```bash
git clone https://github.com/your-org/research-intelligence-n8n.git
cd research-intelligence-n8n
```

**2. Configure environment**
```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
```bash
LLM_API_KEY=your_key_here        # or leave empty for Ollama
N8N_BASIC_AUTH_PASSWORD=choose_a_strong_password
N8N_ENCRYPTION_KEY=generate_a_32_char_random_string
CROSSREF_MAILTO=your@email.edu
```

Generate a secure encryption key:
```bash
openssl rand -hex 32
```

**3. Start services**
```bash
docker compose up -d
```

This starts n8n (port 5678), PostgreSQL, and the document processor.

**4. Verify services are running**
```bash
docker compose ps
docker compose logs n8n | tail -20
```

Wait until n8n shows `Editor is now accessible via: http://localhost:5678`.

**5. Import the workflow**
1. Open http://localhost:5678 in your browser
2. Log in with the credentials from `.env`
3. Click the menu → **Import from file**
4. Select `workflows/core/01_research_orchestrator.json`
5. Click **Save**

**6. Activate the workflow**
1. Open the imported workflow
2. Toggle **Active** in the top-right corner
3. Click the form trigger node to find your form URL

**7. Run your first research**

The form URL will be shown in the form trigger node. Example:
`http://localhost:5678/form/research-intake-form-v2`

Fill in a research topic and submit.

### Optional: Add Ollama (local LLM, no API key needed)
```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull llama3.2:3b
```

Then update `.env`:
```
LLM_API_BASE_URL=http://ollama:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=llama3.2:3b
```

Restart n8n to pick up the new environment:
```bash
docker compose restart n8n
```

---

## Path 2: Manual n8n Setup

If you already have n8n running.

### Prerequisites
- n8n version 1.60.0 or later
- Node.js 18+

### Steps

**1. Configure environment variables**

Add these to your n8n process environment (or `.env` if using n8n's Docker single-container):

```bash
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_key
LLM_MODEL=meta-llama/llama-3.2-3b-instruct:free
OUTPUT_DIR=/path/to/output/directory
CROSSREF_MAILTO=your@email.edu
SEMANTIC_SCHOLAR_API_KEY=   # optional
```

n8n must be restarted after adding environment variables.

**2. Create the output directory**
```bash
mkdir -p /path/to/output/directory
# Ensure n8n process can write to it
chown -R n8n:n8n /path/to/output/directory
```

**3. Import the workflow**

Option A — via UI:
- Settings → Import from file → `workflows/core/01_research_orchestrator.json`

Option B — via CLI:
```bash
n8n import:workflow --input=workflows/core/01_research_orchestrator.json
```

**4. Activate and test**

Activate the workflow in the n8n UI and run a test execution.

---

## Path 3: Quick Demo with Ollama (No API Key)

Fastest way to try the system with fully local AI.

### Prerequisites
- n8n installed locally (`npm install -g n8n`)
- Ollama installed (https://ollama.ai)

### Steps

**1. Start Ollama and pull a model**
```bash
ollama serve &
ollama pull llama3.2:3b
```

**2. Configure n8n environment**
```bash
export LLM_API_BASE_URL=http://localhost:11434/v1
export LLM_API_KEY=ollama
export LLM_MODEL=llama3.2:3b
export OUTPUT_DIR=/tmp/research-output
export CROSSREF_MAILTO=demo@localhost
mkdir -p /tmp/research-output
```

**3. Start n8n**
```bash
n8n start
```

**4. Import and activate the workflow**

Open http://localhost:5678, import `workflows/core/01_research_orchestrator.json`, and activate it.

**5. Submit a research topic**

Find the form URL in the form trigger node and submit a topic.

> **Note on performance:** `llama3.2:3b` is a 3B parameter model. Query refinement and analysis will work, but synthesis quality will be lower than with a larger model. For better results, try `llama3.2:7b` or `qwen2.5:7b`.

---

## Verification Steps

After installation, verify the core components work:

```bash
# 1. n8n is accessible
curl -s http://localhost:5678/healthz

# 2. Document processor is healthy
curl -s http://localhost:8080/health

# 3. ArXiv API is reachable (no auth needed)
curl -s "http://export.arxiv.org/api/query?search_query=all:machine+learning&max_results=1" | head -20

# 4. CrossRef API is reachable
curl -s "https://api.crossref.org/works?query=machine+learning&rows=1" | python3 -m json.tool | head -10
```

---

## Troubleshooting

### n8n can't write output files
```
Error: ENOENT: no such file or directory, open '/output/...'
```
Ensure the output directory exists and n8n has write permission:
```bash
docker compose exec n8n mkdir -p /output
# or for manual install:
mkdir -p /path/to/output && chmod 777 /path/to/output
```

### LLM calls fail with 401
Your `LLM_API_KEY` is not set or is incorrect. Check:
```bash
docker compose exec n8n printenv LLM_API_KEY
```

### LLM calls fail with connection refused
If using Ollama, check it's running:
```bash
curl http://localhost:11434/api/tags
```

If using Docker Compose with Ollama, verify the service is in the `ollama` profile:
```bash
docker compose --profile ollama ps
```

### Human Review Gate: how to approve

After the workflow reaches the `Human Review Gate` node, it pauses. To resume:
1. Find the resume URL in the n8n execution log (or the execution details panel)
2. Send a POST request to it with approval:
```bash
curl -X POST "http://localhost:5678/webhook-waiting/{execution-id}/approval" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "feedback": "Looks good"}'
```
To reject:
```bash
curl -X POST "http://localhost:5678/webhook-waiting/{execution-id}/approval" \
  -H "Content-Type: application/json" \
  -d '{"approved": false, "feedback": "Query was too narrow — please expand date range"}'
```

### PubMed returns no results
PubMed rate limits unauthenticated requests to 3/second. If running multiple research topics rapidly, add an `NCBI_API_KEY` (free, register at https://www.ncbi.nlm.nih.gov/account/).
