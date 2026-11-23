# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [2.0.0] — 2026-11-20

This is a complete reimplementation of the original agentic-literature-survey-workflow. Version 2.0.0 is not backwards-compatible with 1.x workflows or Airtable configurations.

### Added

- **Multi-source retrieval** from 5 scholarly databases: ArXiv, CrossRef, PubMed (esearch + eSummary), OpenAlex, Semantic Scholar
- **Multi-LLM provider support** via configurable OpenAI-compatible endpoint (`LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`). Works with OpenRouter, Ollama, Groq, Gemini, OpenAI, and any OpenAI-compatible provider without changing workflow nodes.
- **Semantic Scholar integration** — real HTTP node using the official Graph API (`api.semanticscholar.org/graph/v1/paper/search`). The original workflow referenced this source in code but had no actual nodes.
- **Human review gate** — Wait node with webhook resume. Workflow pauses for researcher approval before generating final reports. Supports approve/reject with optional feedback.
- **Research gap analysis** — dedicated synthesis node categorizing gaps as empirical, theoretical, methodological, contextual, or temporal.
- **Filesystem-based output** — reports saved as HTML, Markdown, and JSON to configurable `OUTPUT_DIR`. No third-party storage dependency.
- **Source verification sub-workflow** (`03_source_verification.json`) — DOI resolution and CrossRef metadata verification.
- **Document processor service** — FastAPI/PyMuPDF service for structured PDF text extraction. Runs as non-root user. Sections detected: abstract, introduction, methodology, results, discussion, conclusion, references.
- **JSON Schema contracts** for all data types: `research-input.schema.json`, `source.schema.json`, `evidence.schema.json`, `research-output.schema.json`.
- **LLM system prompts** as versioned Markdown files: `query_refiner.md`, `paper_analyzer.md`, `research_synthesizer.md`.
- **Docker Compose** with optional Ollama profile for fully local execution.
- **GitHub Actions CI** — workflow JSON validation and secret scanning on every push/PR.
- **Synthetic test fixtures** in `tests/fixtures/`.
- Full documentation suite: ARCHITECTURE, INSTALLATION, CONFIGURATION, API_INTEGRATIONS, RESEARCH_ETHICS, TESTING.

### Fixed

- **PubMed broken** — original workflow only called esearch (returned IDs with no metadata). Fixed: added eSummary node chained from esearch. PubMed now returns full paper metadata.
- **Aggregation node referenced non-existent nodes** — original code referenced `$('Semantic Scholar - Query 1')` and `$('Semantic Scholar - Query 2')` which did not exist. Fixed: rewrote aggregation to handle the 5 real node names.
- **Paper-analysis matching fragility** — original used array index matching only, which breaks when LLM API returns fewer results than expected. Fixed: 3-tier matching (pairedItem → paper_id → index fallback).
- **`model: "openrouter/free"` invalid** — not a real model identifier. Fixed: replaced with `$env.LLM_MODEL || 'meta-llama/llama-3.2-3b-instruct:free'`.

### Changed

- All LLM calls use direct HTTP Request nodes with `$env.*` expressions instead of LangChain agent nodes. This makes the workflow portable — no credential re-configuration needed after import.

### Removed

- **Airtable integration** — removed entirely. Airtable is a paid SaaS dependency with hardcoded instance-specific IDs (base `appM5EgTQe9Hr3xz4`, table `tbllj5SoTLDX90ini`, credential `37WDOroaDLKeTyzm`). Replaced with filesystem output.
- **Hardcoded API keys** — all literal `"Bearer your_api_key_here"` and OpenAI credential ID `7NAeONPL992FkwEZ` removed.
- **Hardcoded email** — `research@survey.com` CrossRef mailto removed. Replaced with `$env.CROSSREF_MAILTO`.

---

## [1.0.0] — Original

The original `Agentic Literature Survey Workflow.json` from the `agentic-literature-survey-workflow` repository.

**Known issues in 1.0.0** (documented in `docs/EXISTING_WORKFLOW_AUDIT.md`):
- PubMed only retrieved IDs, not paper metadata
- Semantic Scholar code referenced non-existent nodes
- All LLM nodes had hardcoded placeholder API keys
- Mandatory Airtable dependency with hardcoded instance-specific IDs
- No human review or approval step
- No filesystem output
- Fragile paper-analysis matching by array index only
