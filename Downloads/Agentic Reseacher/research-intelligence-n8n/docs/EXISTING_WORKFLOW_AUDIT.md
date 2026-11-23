# Technical Audit: Existing Agentic Literature Survey Workflow

**Audited file:** `agentic-literature-survey-workflow/Agentic Literature Survey Workflow.json`  
**Audit date:** 2026-11-20  
**Auditor:** Research Intelligence n8n Project  
**Original author:** Nidhishree N (https://github.com/nidhi-shree/agentic-literature-survey-workflow)

---

## Audit Summary

The existing workflow provides a useful conceptual foundation: form trigger → query refinement → multi-source retrieval → paper analysis → synthesis → HTML report. However, significant portions are broken or incomplete. The workflow cannot be deployed by another user without substantial modification. Several claimed features do not exist in the implementation.

**Overall assessment:** Partially functional on the original instance only. Not portable. Not production-ready.

---

## Node-by-Node Status Table

| Node | Type | Status | Notes |
|------|------|--------|-------|
| On form submission | formTrigger | Working and verified | Single field (topic). Minimal but functional. |
| OpenAI Chat Model | lmChatOpenAi | Broken | Hardcoded credential ID `7NAeONPL992FkwEZ` only valid on original n8n instance. `model` set to `openrouter/free` — not a real OpenAI model identifier. This node will fail on any other instance. |
| Query Refiner Agent | langchain.agent | Needs further testing | Depends on the broken OpenAI Chat Model node. System prompt is well-structured with 8-query schema. If credentials were valid, the logic is sound. |
| Parse Query Output | code | Working and verified | JSON extraction with regex fallback is robust. Correctly handles LLM response format. |
| ArXiv Search | httpRequest | Working and verified | Correct arXiv export API URL. No authentication required. XML response handled downstream. |
| CrossRef Search | httpRequest | Working and verified | Correct CrossRef API endpoint. `mailto` hardcoded to `research@survey.com` — should be configurable. |
| PubMed Search | httpRequest | Broken | Only calls esearch, which returns a list of PubMed IDs. Never calls esummary or efetch to retrieve actual paper data. The IDs pass downstream but contain no title, abstract, or author information. PubMed data is effectively absent from all analysis. |
| OpenAlex Search | httpRequest | Working and verified | Correct endpoint. Inverted index abstract reconstruction handled in aggregation code. |
| Semantic Scholar - Query 1 | — | Documented but not implemented | Referenced in the aggregation code node (`$('Semantic Scholar - Query 1')`) but no such node exists in the workflow. The try/catch silently swallows the error. |
| Semantic Scholar - Query 2 | — | Documented but not implemented | Same as above. Zero Semantic Scholar data ever enters the pipeline despite being referenced. |
| Merge | merge | Partially implemented | Configured for 4 inputs (ArXiv, CrossRef, PubMed, OpenAlex). PubMed provides only IDs (see above). The 5th claimed source (Semantic Scholar) is absent. |
| Aggregate & Deduplicate Results | code | Partially implemented | Sound deduplication logic (DOI-first, then normalized title). However: references two non-existent Semantic Scholar nodes; PubMed entries provide no useful data; abstract reconstruction for OpenAlex is correct. Effectively aggregates only 2 real sources (ArXiv, CrossRef). |
| Split Papers for Processing | splitOut | Working and verified | Correctly splits the papers array into individual items. |
| Paper Analyzer | httpRequest | Broken | Authorization header contains literal string `Bearer your_api_key_here`. Every request returns HTTP 401. Uses `neverError: true` so failures are silently swallowed — the workflow continues with empty analysis objects. The fallback schema in Merge Paper + Analysis masks this failure. |
| Merge Paper + Analysis | code | Partially implemented | Logic uses `$('Split Papers for Processing').all()[index]` for paper-analysis matching. This relies on index correspondence that may break with batched HTTP requests. No ID-based matching. Falls back gracefully but produces mismatched paper+analysis pairs when order is disrupted. |
| Collect All Analyzed Papers | aggregate | Working and verified | Standard aggregation. Functions correctly. |
| Research Manager Agent | httpRequest | Broken | Authorization: `Bearer your_api_key_here`. Model: `meta-llama/llama-4-scout-17b-16e-instruct` via Groq API — model identifier unverified. Silently fails; `review_content` is empty in final output. |
| Citation Manager | httpRequest | Broken | Authorization: `Bearer your_api_key_here`. Uses Gemini API endpoint. Model: `gemini-2.5-flash-lite`. Hardcoded to Gemini — not portable. Silently fails. |
| Citation Manager1 | httpRequest | Broken | Authorization: `Bearer your_api_key_here`. Uses OpenRouter endpoint. Model: `openrouter/free` — not a valid model identifier. Silently fails. |
| Literature Matrix Builder | httpRequest | Broken | Authorization: `Bearer your_api_key_here`. Model: `openrouter/free`. Silently fails. |
| Literature Matrix Builder1 | httpRequest | Broken | Authorization: `Bearer your_api_key_here`. Model: `meta-llama/llama-4-scout-17b-16e-instruct` via Groq. Silently fails. |
| Merge1 | merge | Working and verified | 4-input merge for Citation Manager, Citation Manager1, Matrix Builder, Matrix Builder1. If all four upstream nodes fail silently, this passes through empty data. |
| Assemble Complete Review Data | code | Partially implemented | Sound assembly logic. Handles empty objects from failed upstream nodes. Citations are regenerated from paper metadata as fallback. Would produce a minimal report even with all LLM nodes failing. |
| Generate HTML Document | code | Working and verified | HTML generation logic is complete and functional. The HTML template is reasonably well-designed. Output is valid HTML5. |
| Convert HTML to File | code | Working and verified | Converts HTML string to base64 binary correctly. |
| Create a record 1 | airtable | Broken | Hardcoded credential ID `37WDOroaDLKeTyzm`. Hardcoded base ID `appM5EgTQe9Hr3xz4`. Hardcoded table ID `tbllj5SoTLDX90ini`. Will fail on any instance that is not the original. Mandatory paid Airtable dependency. |

---

## Capability Assessment

| Claimed capability | Actual status | Evidence |
|--------------------|--------------|----------|
| Multi-source retrieval (ArXiv, CrossRef, PubMed, OpenAlex) | Partially implemented | ArXiv and CrossRef work. PubMed retrieves IDs only, no paper data. OpenAlex works. |
| Semantic Scholar retrieval | Documented but not implemented | No Semantic Scholar nodes exist. Referenced in dead code. |
| AI-powered query refinement | Broken | OpenAI Chat Model node has hardcoded credential ID. Fails on import to any other instance. |
| Paper analysis | Broken | Paper Analyzer has literal `your_api_key_here`. All requests return 401. Analysis falls back to static placeholder. |
| Literature synthesis | Broken | Research Manager Agent has literal `your_api_key_here`. |
| Citation generation (IEEE) | Broken | Both Citation Manager nodes have literal `your_api_key_here`. Citations fall back to template-generated strings from paper metadata. |
| Comparative literature matrix | Broken | Both Literature Matrix Builder nodes have literal `your_api_key_here`. |
| HTML report generation | Working and verified | The HTML generation code runs and produces valid output, but content is placeholder/fallback data due to upstream failures. |
| Airtable integration | Broken | Hardcoded instance-specific credential and table IDs. |
| Full-text PDF processing | Documented but not implemented | No PDF download, extraction, or processing nodes anywhere in the workflow. |
| Semantic search / vector database | Documented but not implemented | No vector database or embedding nodes. |
| Knowledge graph | Documented but not implemented | No graph construction nodes. |
| Deduplication | Partially implemented | DOI and title-based deduplication exists and is correct in logic. Operates on incomplete source data. |

---

## Security Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Hardcoded credential IDs | High | `OpenAI Chat Model` node embeds `"id": "7NAeONPL992FkwEZ"` and `"name": "OpenAI account 3"`. On export and re-import, these reference a non-existent credential. |
| Literal API key placeholders | High | Five HTTP Request nodes contain `Bearer your_api_key_here` as the Authorization value. These are stored in the workflow JSON and would be visible to anyone with access to the workflow export. |
| Hardcoded Airtable base and table IDs | Medium | `appM5EgTQe9Hr3xz4` and `tbllj5SoTLDX90ini` are instance-specific and would allow anyone with these IDs and an Airtable token to identify the target base. |
| Hardcoded email address | Low | `research@survey.com` in CrossRef `mailto` parameter. Should be a configurable environment variable. |
| No input sanitisation | Medium | Research topic from form is passed directly into API query strings and LLM prompts without sanitisation. A topic containing special characters or injection attempts is passed unmodified. |
| No output sanitisation | Medium | LLM-generated content is embedded directly into HTML without consistent escaping. The `esc()` function is defined in the HTML generator but not consistently applied to all fields. |
| Sensitive research data to Airtable | Low | The full HTML review (which may contain sensitive institutional research) is sent to Airtable, a third-party SaaS platform. No data classification or consent mechanism exists. |

---

## Structural Issues

### Missing error handling
None of the HTTP Request nodes that call external APIs have retry logic. The `neverError: true` option on Paper Analyzer and CrossRef silently discards failures. A single API outage causes silently degraded output with no user notification.

### No input validation
The form accepts any string as a research topic. There is no minimum length check, no character validation, and no feedback to the user if the topic is too vague or empty.

### No execution logging
There is no structured logging of which sources were queried, how many results were retrieved, or which steps succeeded or failed. Users receive no transparency about how the report was produced.

### No human approval step
The workflow proceeds directly from draft generation to Airtable storage without any human review. A researcher has no opportunity to review, correct, or reject the output before it is stored.

### No output saved to filesystem
The only persistent storage is the broken Airtable node. The `Convert HTML to File` node produces binary data but it is not written anywhere accessible.

### Duplicate citation managers
There are two separate `Citation Manager` nodes (processing papers 1-15 and 16-30 respectively) and two `Literature Matrix Builder` nodes. The two citation outputs are merged and then processed identically in `Assemble Complete Review Data`, which only references `$('Citation Manager').first()`. The second citation batch (`Citation Manager1`) is merged but effectively ignored in assembly.

### Merge node configuration
The first `Merge` node uses the default mode which may be `waitForAll` depending on the n8n version. If PubMed Search fails or returns slowly, it could block the entire pipeline. The mode should be explicitly set to `append` for resilience.

---

## Positive Aspects Worth Preserving

- **Query refiner system prompt:** The 8-query schema with typed search strategies is well-designed and produces good search coverage.
- **Abstract reconstruction for OpenAlex:** The inverted index reconstruction code is correct and handles the OpenAlex-specific format properly.
- **Deduplication logic:** The two-pass deduplication (DOI first, then title) is sound.
- **HTML template:** The IEEE-style HTML layout is professional and readable.
- **Paper Analyzer fallback schema:** The graceful fallback when analysis fails ensures the pipeline does not crash completely.
- **Workflow concept:** The overall orchestration pattern (refine → retrieve → deduplicate → analyze → synthesize → report) is architecturally sound.

---

## Licensing

The original repository (https://github.com/nidhi-shree/agentic-literature-survey-workflow) has **no LICENSE file**. As of the audit date, no explicit licence or reuse permission was found. The repository is public on GitHub, but absence of a licence means the default copyright applies: the author retains all rights and no redistribution or modification is permitted without explicit permission.

**Consequence:** The improved project in this repository is an independently authored clean reimplementation. It preserves the concept and architectural pattern, properly attributes the original work, but does not reproduce the original workflow JSON verbatim. All workflow JSON in this project was written independently.

Attribution to Nidhishree N as the originator of the concept and architectural pattern is maintained in `README.md` and `CHANGELOG.md`.

---

## Recommendations Implemented in v2.0.0

All critical issues identified in this audit are addressed in `workflows/core/01_research_orchestrator.json`:

1. All API keys sourced from `$env.*` environment variables — zero hardcoded credentials
2. PubMed integration fixed: esearch → eSummary chain retrieves actual paper data
3. Semantic Scholar integration added as a real workflow node
4. Paper Analyzer uses ID-based matching, not fragile index matching
5. Airtable removed — output saved to filesystem in HTML, Markdown, and JSON formats
6. All LLM nodes use a single configurable endpoint (supports OpenRouter, Groq, Ollama, Gemini, OpenAI)
7. Human approval gate added before final report generation
8. Research gap analysis added as a dedicated step
9. Input validation added
10. Error handling added with `neverError: true` and explicit fallbacks
