# Contributing

Contributions are welcome. This document explains how to contribute effectively.

---

## Before you start

- Check the [open issues](../../issues) to avoid duplicate work.
- For significant changes (new workflows, new database integrations, schema changes), open an issue first to discuss the approach.
- Small fixes (typos, documentation, bug fixes) can go directly to a PR.

---

## Setup

```bash
git clone https://github.com/your-org/research-intelligence-n8n.git
cd research-intelligence-n8n
cp .env.example .env
# Edit .env with your credentials
docker compose up -d
```

Import the workflow and verify it runs before making changes.

---

## What to contribute

### High-value contributions

- **Additional scholarly database integrations** (JSTOR, IEEE Xplore, Springer, Scopus via Elsevier API, Web of Science API) — follow the same normalization pattern as existing sources
- **Additional citation formats** — extend the citation generation prompt
- **Language support** — the system is English-only; multilingual query refinement would be valuable
- **Better abstract reconstruction** — the OpenAlex inverted-index reconstruction has known punctuation issues
- **Improved deduplication** — fuzzy title matching for papers with slightly different titles across sources
- **Sub-workflow integrations** — extend `03_source_verification.json` with additional verification steps

### Documentation contributions

- Corrections to `docs/API_INTEGRATIONS.md` if API endpoints or response formats have changed
- Additional troubleshooting entries in `docs/INSTALLATION.md`
- Additional examples in `docs/CONFIGURATION.md`

---

## Code standards

### n8n workflow JSON

- **No hardcoded credentials.** All API keys via `$env.VAR_NAME` expressions.
- **No hardcoded credential IDs.** Credentials in `credentials` blocks must use `"id": ""` or be omitted if the node uses HTTP Request with expression-based auth.
- **All LLM calls must follow the standard pattern:**
  ```json
  "url": "={{ ($env.LLM_API_BASE_URL || 'https://openrouter.ai/api/v1') + '/chat/completions' }}",
  "authentication": "genericCredentialType",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [{"name": "Authorization", "value": "=Bearer {{ $env.LLM_API_KEY || '' }}"}]
  }
  ```
- **Workflow JSON must pass CI validation:** `jq . workflow.json > /dev/null`
- **New nodes must have meaningful names.** Not "HTTP Request 3" — use "Fetch Springer Metadata".

### Python (document processor)

- Type hints required. `mypy` or Pyright compatible.
- No `Any` in production paths.
- FastAPI endpoints must have `response_model` set.
- Dependencies must be pinned with exact versions in `requirements.txt`.

### Documentation

- API documentation must cite the official API documentation.
- Do not document private or unofficial API endpoints.
- Include rate limit information for any new API integration.

---

## Pull request process

1. Fork the repository and create a branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run the CI checks locally:
   ```bash
   # Validate workflow JSON
   find workflows/ -name '*.json' -exec jq . {} \; > /dev/null
   
   # Check for secrets
   grep -r "your_api_key_here" workflows/ && echo "FAIL"
   
   # Python checks (if you modified the document processor
   pip install pip-audit
   pip-audit -r services/document-processor/requirements.txt
   ```
4. Update documentation if you changed behavior
5. Update `CHANGELOG.md` under `[Unreleased]`
6. Submit a PR with a clear description of what changed and why
---

## Schema changes

The JSON schemas in `schemas/` are contracts between workflow nodes. Breaking changes require:

1. A version bump in the schema (`$id` field)
2. Updated workflow nodes that consume the schema
3. Updated test fixtures in `tests/fixtures/`
4. A note in `CHANGELOG.md`

Adding optional fields is non-breaking. Removing required fields or changing field types is breaking.

---

## Reporting bugs

Include:
- n8n version (`Settings → About`)
- LLM provider and model (redact the API key)
- Which node failed and the error message
- Whether the issue is reproducible with the test fixtures

---

## Code of conduct

Be direct. Explain your reasoning. Disagreement is fine; dismissal is not.
