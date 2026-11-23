# Testing Guide

This document covers how to test the Research Intelligence n8n system: from quick smoke tests to full end-to-end runs.

---

## CI Checks (GitHub Actions)

Two automated checks run on every push and pull request:

### `workflow-validation.yml`
- Validates all JSON files in `workflows/` are syntactically valid
- Checks for hardcoded API keys and credential IDs
- Checks all workflows have required fields: `name`, `nodes`, `connections`

### `security-checks.yml`
- Scans for hardcoded secrets matching common patterns (OpenAI keys, Airtable IDs, etc.)
- Checks `.env` is not committed
- Checks `.env.example` has no real values
- Audits Python dependencies in `services/document-processor/requirements.txt` with `pip-audit`
- Checks Dockerfile uses a non-root user

Run locally:
```bash
# Validate workflow JSON
jq . workflows/core/01_research_orchestrator.json > /dev/null && echo "Valid JSON"

# Check for hardcoded secrets
grep -r "your_api_key_here" workflows/ && echo "FAIL: placeholder found"
grep -rE '"sk-[a-zA-Z0-9]{20,}"' workflows/ && echo "FAIL: possible real key found"
```

---

## Test Fixtures

Located in `tests/fixtures/`:

- **`sample_papers.json`** — 5 synthetic paper records conforming to `source.schema.json`. These are entirely fabricated papers and must not be cited in academic work.
- **`sample_analysis_response.json`** — Synthetic LLM API response (OpenAI-compatible format) for a single paper analysis. Used for testing the `Merge Paper + Analysis` node logic without calling an LLM.

### Using fixtures to test the aggregation node

The aggregation node's `Aggregate & Deduplicate` code can be tested by injecting the fixture data as the node's input. In n8n:

1. Open the workflow in the n8n editor
2. Click `Aggregate & Deduplicate`
3. Click the input data icon → paste the contents of `sample_papers.json`
4. Click "Execute node"
5. Verify the output contains deduplicated papers sorted by citation count

---

## Manual Smoke Tests

### 1. Document processor health
```bash
curl -s http://localhost:8080/health
# Expected: {"status":"ok","service":"document-processor","version":"1.0.0"}
```

### 2. Document processor extraction (base64 PDF)
```bash
# Download a small open-access PDF and base64-encode it
curl -s https://arxiv.org/pdf/2301.00001 | base64 | head -c 1000 > /tmp/test_pdf_b64.txt

# Send to extraction endpoint
curl -s -X POST http://localhost:8080/extract \
  -H "Content-Type: application/json" \
  -d "{\"base64_pdf\": \"$(cat /tmp/test_pdf_b64.txt)\"}" | python3 -m json.tool
```
Expected: JSON response with `title`, `abstract`, `page_count`, `word_count` fields.

### 3. n8n workflow test execution

The fastest way to test the full workflow without waiting for a real research run:

1. Open the workflow in n8n
2. Click the **Test workflow** button (not Activate)
3. n8n will show the trigger form — fill in a simple, narrow topic
4. Watch each node execute in real time
5. Check the output of each node for errors

Recommended test topics (narrow, well-indexed, quick results):
- "BERT language model fine-tuning" (CS, good ArXiv/Semantic Scholar coverage)
- "CRISPR gene editing ethics" (Biomedical, good PubMed coverage)
- "carbon capture technology review" (Multidisciplinary, good CrossRef coverage)

### 4. API connectivity tests

Run these to verify each database is reachable before running a full workflow:

```bash
# ArXiv
curl -s "http://export.arxiv.org/api/query?search_query=all:machine+learning&max_results=2" | \
  grep -c "<entry>" && echo "ArXiv: OK"

# CrossRef
curl -s "https://api.crossref.org/works?query=machine+learning&rows=2" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'CrossRef: OK — {d[\"message\"][\"total-results\"]} results')"

# PubMed esearch
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=machine+learning&retmax=2&retmode=json" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'PubMed esearch: OK — found {len(d[\"esearchresult\"][\"idlist\"])} IDs')"

# OpenAlex
curl -s "https://api.openalex.org/works?search=machine+learning&per-page=2" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OpenAlex: OK — {d[\"meta\"][\"count\"]} total results')"

# Semantic Scholar
curl -s "https://api.semanticscholar.org/graph/v1/paper/search?query=machine+learning&limit=2&fields=title" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Semantic Scholar: OK — {len(d[\"data\"])} results')"
```

### 5. LLM connectivity test

```bash
# Replace with your actual values
curl -s -X POST "${LLM_API_BASE_URL}/chat/completions" \
  -H "Authorization: Bearer ${LLM_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model": "'"${LLM_MODEL}"'", "messages": [{"role": "user", "content": "Reply with just the word: WORKING"}], "max_tokens": 10}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('LLM:', d['choices'][0]['message']['content'])"
```

---

## Schema Validation

Validate a generated output file against the JSON Schema:

```bash
pip install jsonschema

python3 -c "
import json
import jsonschema

with open('schemas/research-output.schema.json') as f:
    schema = json.load(f)

with open('/output/your_research_id_data.json') as f:
    data = json.load(f)

jsonschema.validate(data, schema)
print('Schema validation passed.')
"
```

---

## Load Testing

If running multiple concurrent research workflows:

1. Each workflow run calls 5 database APIs. Respect their rate limits (see `docs/API_INTEGRATIONS.md`).
2. Each workflow makes 1 LLM call per paper (default cap: 50 papers) plus 5 synthesis calls. At 50 papers, that is ~55 LLM calls per workflow run.
3. The n8n default execution timeout is 1 hour. Long topics with many papers may hit this limit.

For heavy use, consider:
- Setting `NCBI_API_KEY` and `SEMANTIC_SCHOLAR_API_KEY` for higher API rate limits
- Reducing the paper cap in the `Validate & Configure` node
- Using a faster/cheaper LLM model for paper analysis (reserving the stronger model for synthesis)

---

## Known Test Limitations

- There are no automated unit tests for individual n8n node logic (n8n does not currently support unit testing of Code nodes outside of a live n8n instance).
- The document processor is covered by its own type annotations (Pydantic) and can be tested with `pytest` if desired.
- End-to-end tests require live API credentials and network access.
