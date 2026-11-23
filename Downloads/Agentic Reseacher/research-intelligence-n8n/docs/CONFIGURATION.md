# Configuration Reference

All configuration is via environment variables. Copy `.env.example` to `.env` and edit it. n8n reads these at startup — restart n8n after any change.

---

## LLM Provider

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_API_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenAI-compatible API base URL. Change this to switch providers. |
| `LLM_API_KEY` | Yes | — | API key for the LLM provider. For Ollama, use the string `ollama`. |
| `LLM_MODEL` | No | `meta-llama/llama-3.2-3b-instruct:free` | Model identifier. Must match the provider's model naming. |
| `LLM_MAX_TOKENS` | No | `4096` | Maximum tokens in LLM response. Increase for longer synthesis outputs. |
| `LLM_TEMPERATURE` | No | `0.3` | Temperature (0.0–1.0). Lower = more deterministic. Research tasks work best at 0.2–0.4. |

### Provider-specific examples

**OpenRouter (free models — recommended for getting started)**
```bash
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-v1-your-key-here
LLM_MODEL=meta-llama/llama-3.2-3b-instruct:free
```
Free models are rate-limited. If you get 429 errors, add a small delay between paper analysis calls or switch to a paid model.

**OpenRouter (paid models — better quality)**
```bash
LLM_MODEL=anthropic/claude-3-haiku
# or
LLM_MODEL=openai/gpt-4o-mini
```

**Ollama (local, no API key)**
```bash
LLM_API_BASE_URL=http://ollama:11434/v1    # Docker Compose
# LLM_API_BASE_URL=http://localhost:11434/v1  # Manual install
LLM_API_KEY=ollama
LLM_MODEL=llama3.2:3b
```

**Groq (fast inference, free tier)**
```bash
LLM_API_BASE_URL=https://api.groq.com/openai/v1
LLM_API_KEY=gsk_your-key-here
LLM_MODEL=llama-3.1-8b-instant
```

**Google Gemini**
```bash
LLM_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/v1
LLM_API_KEY=AIzaSy-your-key-here
LLM_MODEL=gemini-2.0-flash
```

**OpenAI**
```bash
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o-mini
```

---

## Academic Databases

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CROSSREF_MAILTO` | Recommended | — | Your email for CrossRef Polite Pool. Gets higher rate limits. |
| `NCBI_API_KEY` | No | — | NCBI API key. Without it: 3 req/sec. With it: 10 req/sec. Free at ncbi.nlm.nih.gov/account. |
| `SEMANTIC_SCHOLAR_API_KEY` | No | — | Semantic Scholar API key. Without it: 100 req/5min. With it: 1 req/sec. Free at semanticscholar.org/product/api. |

---

## Output

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OUTPUT_DIR` | No | `/output` | Directory where report files are written. Must be writable by n8n. |

Output files per research run:
- `{research_id}_review.html` — formatted HTML report
- `{research_id}_review.md` — Markdown report
- `{research_id}_data.json` — full structured data

---

## n8n Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `N8N_ENCRYPTION_KEY` | Yes | — | 32-character random string. Encrypts stored credentials. Generate with `openssl rand -hex 32`. **Set this before first run. Cannot be changed without re-entering all credentials.** |
| `N8N_BASIC_AUTH_ACTIVE` | No | `true` | Enable HTTP basic auth on the n8n UI. Keep `true` in production. |
| `N8N_BASIC_AUTH_USER` | No | `admin` | Username for n8n UI basic auth. |
| `N8N_BASIC_AUTH_PASSWORD` | Yes | — | Password for n8n UI basic auth. Change from default before exposing to network. |
| `N8N_HOST` | No | `localhost` | Hostname n8n listens on. |
| `N8N_PORT` | No | `5678` | Port n8n listens on. |
| `N8N_PROTOCOL` | No | `http` | `http` or `https`. Set to `https` with a reverse proxy. |
| `WEBHOOK_URL` | No | Auto-detected | Public URL for webhooks (used by human review gate). Set if behind a reverse proxy. e.g. `https://n8n.yourlab.edu`. |

---

## PostgreSQL (Docker Compose)

Only relevant when using `docker compose`. Not required for manual n8n installs.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_DB` | No | `research_intelligence` | Database name. |
| `POSTGRES_USER` | No | `n8n` | Database user. |
| `POSTGRES_PASSWORD` | Yes | — | Database password. Must be set before first run. |
| `POSTGRES_HOST` | No | `postgres` | Hostname of PostgreSQL server. |
| `POSTGRES_PORT` | No | `5432` | Port of PostgreSQL server. |

---

## Document Processor Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAX_PDF_SIZE_MB` | No | `50` | Maximum PDF size in MB. PDFs larger than this are rejected. |
| `FETCH_TIMEOUT_SEC` | No | `30` | Timeout in seconds for fetching PDFs from URLs. |
| `LOG_LEVEL` | No | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR`. |

---

## Minimum viable configuration

The minimum to get a working system:

```bash
LLM_API_KEY=your_key_here
N8N_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
N8N_BASIC_AUTH_PASSWORD=choose_a_strong_password
POSTGRES_PASSWORD=another_strong_password
CROSSREF_MAILTO=your@email.edu
```

Everything else has a sensible default for development. For production, also set `WEBHOOK_URL` and `N8N_PROTOCOL=https`.

---

## Security checklist

Before exposing n8n to the internet:

- [ ] `N8N_ENCRYPTION_KEY` is set to a unique, randomly generated 32-character value
- [ ] `N8N_BASIC_AUTH_PASSWORD` is a strong, unique password (not `admin` or `password`)
- [ ] `POSTGRES_PASSWORD` is a strong, unique password
- [ ] `.env` is in `.gitignore` and never committed
- [ ] `WEBHOOK_URL` is set to your HTTPS URL if using a reverse proxy
- [ ] `N8N_PROTOCOL=https`
- [ ] The document processor port (8080) is NOT exposed publicly (it has no authentication)
