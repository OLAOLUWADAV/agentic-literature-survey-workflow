# Agentic Literature Survey Workflow

> Self-hostable academic literature review automation powered by n8n.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![n8n](https://img.shields.io/badge/built%20with-n8n-orange)](https://n8n.io)
[![Docker](https://img.shields.io/badge/docker-compose-blue)](docker-compose.yml)

Searches five scholarly databases simultaneously, scores and deduplicates papers, runs AI-assisted analysis, then generates a **full structured literature review** — with inline citation markers, 5 bibliometric charts, and an optional chapter layout — in HTML, Markdown, and JSON.

**No paid dependencies.** No Airtable, no mandatory API subscriptions. Free academic APIs + your choice of free or paid LLM.

---

## What it does

1. **Multi-source retrieval** — Searches ArXiv, CrossRef, PubMed, OpenAlex, and Semantic Scholar in parallel. All five are free.
2. **Deduplication** — Normalizes paper metadata across sources. Deduplicates by DOI first, then by normalized title.
3. **AI-assisted analysis** — Sends each paper's abstract to your LLM. Extracts: research problem, methodology, key findings, strengths, limitations, innovation score (0–10).
4. **Synthesis** — Generates thematic literature synthesis, identifies research gaps by category (empirical, theoretical, methodological, contextual, temporal), and builds a structured literature matrix for up to 50 papers.
5. **Human review gate** — Pauses the workflow. You review the draft and approve or reject before final reports are generated.
6. **Report generation** — Full HTML report with inline `[N]` citation markers, 5 bibliometric SVG charts, optional chapter layout, evidence cards (Appendix B), and a 50-paper literature matrix (Appendix C). Also exports Markdown and JSON.

---

## Supported LLM providers

All providers use the same OpenAI-compatible endpoint pattern. Switch by changing three environment variables.

| Provider | Free tier | Local |
|----------|-----------|-------|
| OpenRouter (free models) | Yes | No |
| Ollama | Yes (hardware cost) | Yes |
| Groq | Yes (rate limited) | No |
| Google Gemini | Yes (rate limited) | No |
| OpenAI | No | No |
| Anthropic (via OpenRouter) | No | No |

---

## Quick start (5 minutes with Docker)

**Prerequisites:** Docker Desktop

```bash
git clone https://github.com/OLAOLUWADAV/agentic-literature-survey-workflow.git
cd agentic-literature-survey-workflow/Downloads/Agentic\ Reseacher/research-intelligence-n8n

cp .env.example .env
# Edit .env — set LLM_API_KEY, N8N_ENCRYPTION_KEY, N8N_BASIC_AUTH_PASSWORD

docker compose up -d
```

Open http://localhost:5678, import `workflows/core/01_research_orchestrator.json`, activate, and submit a research topic.

For the fastest no-API-key start, use Ollama:
```bash
docker compose --profile ollama up -d
docker compose exec ollama ollama pull llama3.2:3b
# Set LLM_API_BASE_URL=http://ollama:11434/v1, LLM_API_KEY=ollama, LLM_MODEL=llama3.2:3b in .env
docker compose restart n8n
```

Full installation guide: [`docs/INSTALLATION.md`](docs/INSTALLATION.md)

---

## Report output

The HTML report is self-contained — one file, no external dependencies — and includes:

| Section | Description |
|---------|-------------|
| Executive summary | 3-paragraph synthesis with inline `[N]` citation links |
| Introduction | ≥ 600 words, cited throughout |
| Background | ≥ 500 words theoretical framework |
| Thematic sections | ≥ 500 words each; consensus vs. contested findings |
| Research gaps | 5 evidence-based gaps, traceable to specific papers |
| Future directions | Grounded in identified gaps |
| Appendix A: 5 bibliometric charts | Publications/year, sources, citation distribution, scatter, categories |
| Appendix B: Evidence cards | One card per paper with anchor links from inline citations |
| Appendix C: Literature matrix | Up to 50 papers with innovation scores, methodology and findings |

**Report formats:** `Standard Summary` (single page) or `Full Report with Chapters` (numbered chapters, TOC, print page-breaks).

### Bibliometric charts

All five charts use a consistent report-style visual: open spine (left + bottom only), gradient bar fills, bold blue value labels, and faint grid lines.

| Chart | Shows |
|-------|-------|
| Publications per year | Annual paper counts, navy→cobalt gradient bars |
| Papers by database | Source distribution with count + % labels |
| Citation distribution | Log-binned histogram, crimson→red gradient |
| Citation vs. year scatter | Each paper as a dot; white ring separates overlaps |
| Paper categories | Research-stream breakdown, 7-colour palette |

---

## Repository structure

```
.
├── workflows/
│   ├── core/
│   │   └── 01_research_orchestrator.json    # Main workflow (import this)
│   └── source-verification/
│       └── 03_source_verification.json      # DOI verification sub-workflow
├── services/
│   └── document-processor/                  # FastAPI PDF extraction service
│       ├── app.py
│       ├── Dockerfile
│       └── requirements.txt
├── schemas/                                 # JSON Schema contracts
│   ├── research-input.schema.json
│   ├── source.schema.json
│   ├── evidence.schema.json
│   └── research-output.schema.json
├── prompts/
│   └── agents/                              # LLM system prompts
│       ├── query_refiner.md
│       ├── paper_analyzer.md
│       └── research_synthesizer.md
├── tests/
│   └── fixtures/                            # Synthetic test data
│       ├── sample_papers.json
│       └── sample_analysis_response.json
├── docs/
│   ├── EXISTING_WORKFLOW_AUDIT.md           # Audit of the original workflow
│   ├── ARCHITECTURE.md
│   ├── INSTALLATION.md
│   ├── CONFIGURATION.md
│   ├── API_INTEGRATIONS.md
│   ├── RESEARCH_ETHICS.md
│   └── TESTING.md
├── .github/workflows/
│   ├── workflow-validation.yml
│   └── security-checks.yml
├── docker-compose.yml
├── .env.example
├── CONTRIBUTING.md
├── SECURITY.md
└── CHANGELOG.md
```

---

## Configuration

Minimum required environment variables:

```bash
LLM_API_KEY=your_llm_api_key
N8N_ENCRYPTION_KEY=generate_with_openssl_rand_hex_32
N8N_BASIC_AUTH_PASSWORD=choose_a_strong_password
POSTGRES_PASSWORD=another_strong_password
CROSSREF_MAILTO=your@email.edu
```

Full reference: [`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)

---

## Academic database coverage

| Source | Type | Free | Auth |
|--------|------|------|------|
| ArXiv | Preprints | Yes | None |
| CrossRef | Published papers | Yes | Email (improves limits) |
| PubMed | Biomedical | Yes | NCBI key (optional, free) |
| OpenAlex | All fields | Yes | None |
| Semantic Scholar | All fields | Yes | API key (optional, free) |

---

## What was fixed from the original workflow

This is a complete reimplementation of an existing n8n literature review workflow. Key fixes:

| Issue | Fix |
|-------|-----|
| PubMed only called esearch (returned IDs with no metadata) | Added eSummary node chained from esearch |
| Semantic Scholar referenced in code but had no actual nodes | Added real HTTP node using the official Graph API |
| All LLM calls used hardcoded `"Bearer your_api_key_here"` | All credentials via `$env.*` expressions |
| Airtable with hardcoded base/table IDs (mandatory paid dependency) | Replaced with `writeBinaryFile` to `OUTPUT_DIR` |
| Hardcoded credential IDs in LangChain nodes (broke portability) | Replaced with direct HTTP requests + env var expressions |
| Paper-analysis matching used fragile index-only approach | 3-tier matching: pairedItem → paper_id → index fallback |
| No human approval step | Added Wait node with webhook resume + approval check |
| Aggregation code referenced non-existent nodes | Rewrote to handle all 5 real source nodes |

Full audit: [`docs/EXISTING_WORKFLOW_AUDIT.md`](docs/EXISTING_WORKFLOW_AUDIT.md)

---

## Important: AI disclosure

Every report includes an AI disclosure section. If you use this output in academic work, you must disclose AI assistance. The form of disclosure varies by publisher — check their current policy.

Read [`docs/RESEARCH_ETHICS.md`](docs/RESEARCH_ETHICS.md) before using this in research.

---

## License

MIT — see [`LICENSE`](LICENSE)

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md)

---

## Security

See [`SECURITY.md`](SECURITY.md) for the security policy and how to report vulnerabilities.
