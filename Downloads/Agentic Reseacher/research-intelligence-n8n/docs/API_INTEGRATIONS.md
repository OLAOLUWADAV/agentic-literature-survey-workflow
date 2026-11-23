# Academic Database API Integrations

All five scholarly databases used in this system are free and require no paid subscription. This document covers what each API provides, its limits, and how the workflow uses it.

---

## ArXiv Export API

**Base URL:** `http://export.arxiv.org/api/query`  
**Auth:** None  
**Cost:** Free

### What it is
ArXiv is a preprint repository covering physics, mathematics, computer science, quantitative biology, quantitative finance, statistics, electrical engineering, economics, and systems science. All papers are freely available as PDFs. It is the primary preprint repository for STEM fields.

### Endpoint used
```
GET http://export.arxiv.org/api/query?search_query={query}&max_results=25&sortBy=relevance&sortOrder=descending
```

### Response format
XML (Atom feed). The workflow uses JavaScript to parse `<entry>` elements.

Key fields extracted:
- `<id>` → URL (e.g., `http://arxiv.org/abs/2401.00001v1`)
- `<title>`
- `<author><name>` (multiple)
- `<published>` → year
- `<summary>` → abstract
- `<link title="pdf">` → PDF URL

### Rate limits
ArXiv requests polite use. No hard rate limit is documented, but bulk queries should be spaced at least 3 seconds apart. The workflow sends one query at a time.

### Notes
- ArXiv IDs can be used to construct direct PDF download URLs: `https://arxiv.org/pdf/{id}.pdf`
- Preprints are not peer-reviewed. The LLM analysis prompt notes when a paper is from ArXiv.
- ArXiv does not provide citation counts.

---

## CrossRef REST API

**Base URL:** `https://api.crossref.org`  
**Auth:** None (Polite Pool: add `mailto=` parameter)  
**Cost:** Free

### What it is
CrossRef is the official DOI registration agency for scholarly publishing. It has metadata for over 150 million scholarly works. It is the most reliable source for DOIs, publisher information, and citation counts.

### Endpoint used
```
GET https://api.crossref.org/works?query={query}&rows=25&sort=relevance&mailto={CROSSREF_MAILTO}
```

### Response format
JSON. The workflow extracts from `message.items[]`.

Key fields extracted:
- `DOI`
- `title[0]`
- `author[]` (family + given names)
- `published-print.date-parts[0][0]` → year
- `abstract`
- `is-referenced-by-count` → citation count
- `URL` → publisher URL
- `container-title[0]` → journal name

### Rate limits
**Polite Pool:** With `mailto=your@email.com` in the query string, CrossRef places requests in the Polite Pool, which has much higher limits and better cache behavior. Without it, requests hit the standard pool: 50 requests/second.

Always set `CROSSREF_MAILTO` in your environment.

### Notes
- CrossRef abstracts may be HTML-encoded (contain `<jats:p>` tags). The aggregation node strips these.
- Not all papers have abstracts in CrossRef. CrossRef metadata is often more complete for DOI and citation count than for abstract.
- CrossRef is the most reliable source for DOI-based deduplication.

---

## PubMed NCBI E-utilities API

**Base URL:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/`  
**Auth:** None (NCBI API key improves rate limit)  
**Cost:** Free

### What it is
PubMed is the primary database for biomedical and life sciences literature, maintained by the US National Library of Medicine. It indexes over 35 million articles from MEDLINE, life science journals, and online books.

### Two-step retrieval (critical — this is the fix from the original workflow)

PubMed's E-utilities require two separate API calls. This is not optional.

**Step 1: esearch — get IDs**
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pubmed
  &term={query}
  &retmax=25
  &retmode=json
```
Returns: `esearchresult.idlist` — an array of PubMed IDs (PMIDs), e.g. `["38012345", "37654321"]`

**Step 2: eSummary — get metadata for those IDs**
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
  ?db=pubmed
  &id={comma-separated-pmids}
  &retmode=json
```
Returns: `result` object keyed by PMID, each with title, authors, pubdate, source (journal), etc.

The original workflow only called esearch and returned IDs with no metadata. The fixed workflow chains both calls.

### Response format
JSON. eSummary response format:
```json
{
  "result": {
    "38012345": {
      "uid": "38012345",
      "title": "...",
      "authors": [{"name": "Smith J"}],
      "pubdate": "2024 Jan",
      "source": "Nature",
      "volume": "601",
      "issue": "7891",
      "pages": "52-57",
      "articleids": [{"idtype": "doi", "value": "10.1038/..."}]
    }
  }
}
```

### Rate limits
- Without API key: 3 requests/second
- With API key: 10 requests/second
- Register free at: https://www.ncbi.nlm.nih.gov/account/

Set `NCBI_API_KEY` in your environment to increase the rate limit.

### Notes
- PubMed abstracts are not in the eSummary response — only titles and metadata. For abstracts, use PubMed's efetch endpoint with `&rettype=abstract&retmode=xml` (not currently implemented in this workflow).
- For biomedical topics, PubMed is the most important source. For other disciplines, it may return few or no results.

---

## OpenAlex API

**Base URL:** `https://api.openalex.org`  
**Auth:** None (email improves rate limit)  
**Cost:** Free

### What it is
OpenAlex is an open, freely available catalog of scholarly works, authors, institutions, and research topics. It has over 250 million works and is maintained by a non-profit. It is the best free alternative to Scopus or Web of Science for broad coverage.

### Endpoint used
```
GET https://api.openalex.org/works
  ?search={query}
  &per-page=25
  &sort=relevance_score:desc
  &select=id,title,authorships,publication_year,doi,abstract_inverted_index,open_access,cited_by_count,primary_location
  &mailto={CROSSREF_MAILTO}
```

### Response format
JSON. `results[]` array.

### Abstract reconstruction (inverted index)

OpenAlex stores abstracts as an "inverted index" — a mapping from each word to its positions in the text. This is unusual and requires reconstruction.

The workflow reconstructs abstracts with:
```javascript
const invertedIndex = paper.abstract_inverted_index || {};
const wordPositions = [];
for (const [word, positions] of Object.entries(invertedIndex)) {
  for (const pos of positions) {
    wordPositions.push({ word, pos });
  }
}
wordPositions.sort((a, b) => a.pos - b.pos);
const abstract = wordPositions.map(wp => wp.word).join(' ');
```

### Rate limits
- Without email: lower limits
- With `mailto=your@email.com` in query: higher limits
- Uses the same `CROSSREF_MAILTO` variable as CrossRef

### Notes
- OpenAlex has very broad coverage across all disciplines.
- Citation counts (`cited_by_count`) are reliable.
- Open access status (`open_access.is_oa`) is available.
- The inverted index abstract reconstruction may not reproduce the original spacing exactly around punctuation — this is a known limitation of the OpenAlex format.

---

## Semantic Scholar Graph API

**Base URL:** `https://api.semanticscholar.org/graph/v1`  
**Auth:** None (free API key improves rate limit)  
**Cost:** Free

### What it is
Semantic Scholar is an AI-powered research search engine maintained by the Allen Institute for AI. It has 220+ million papers across all fields, with high-quality citation graphs and semantic search.

### Endpoint used
```
GET https://api.semanticscholar.org/graph/v1/paper/search
  ?query={query}
  &limit=25
  &fields=paperId,title,authors,year,abstract,citationCount,isOpenAccess,openAccessPdf,externalIds
```

### Authentication header
```
x-api-key: {SEMANTIC_SCHOLAR_API_KEY}
```
If `SEMANTIC_SCHOLAR_API_KEY` is not set, the header is sent empty — the API still works but at lower rate limits.

Register for a free API key at: https://www.semanticscholar.org/product/api

### Response format
JSON. `data[]` array.

Key fields extracted:
- `paperId` → Semantic Scholar ID
- `title`
- `authors[].name`
- `year`
- `abstract`
- `citationCount`
- `isOpenAccess`
- `openAccessPdf.url` → PDF URL if available
- `externalIds.DOI` → DOI

### Rate limits
- Without API key: 100 requests per 5 minutes
- With API key: 1 request per second

### Notes
- Semantic Scholar's semantic search often surfaces papers that keyword search on other databases misses.
- The `externalIds.DOI` field enables cross-source deduplication.
- For papers with open access PDFs, the document processor can extract full text.

---

## Deduplication Strategy

After collecting papers from all 5 sources, the `Aggregate & Deduplicate` node normalizes and deduplicates:

1. **DOI deduplication:** If two papers share the same DOI (normalized to lowercase), keep the one with more metadata (prefer CrossRef > PubMed > OpenAlex > Semantic Scholar > ArXiv).

2. **Title deduplication:** If two papers have no DOI but the same normalized title (lowercase, stripped of punctuation, whitespace collapsed), keep the one with higher citation count.

3. **Sort:** Final list sorted by citation count descending, so the most-cited papers are analyzed first.

4. **Cap:** Default maximum 50 papers proceed to analysis. This prevents excessively long LLM analysis chains. Configurable in the `Validate & Configure` node.
