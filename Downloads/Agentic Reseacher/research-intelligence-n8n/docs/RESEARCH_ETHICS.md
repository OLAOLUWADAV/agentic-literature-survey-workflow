# Research Ethics and Responsible Use

This document covers the ethical obligations that apply when using AI-assisted literature review tools, including this one. These are not warnings to skip — they are the difference between research that holds up and research that does not.

---

## 1. AI Use Disclosure

Every output from this system includes an `ai_disclosure` section in the JSON data:

```json
{
  "ai_disclosure": {
    "tool": "Research Intelligence n8n",
    "llm_provider": "...",
    "model": "...",
    "version": "2.0.0",
    "role": "Query refinement, paper analysis, synthesis, and citation formatting were AI-assisted. Source retrieval used documented APIs. Human researcher approved the final output.",
    "disclosure_required": true
  }
}
```

**What this means in practice:**

- If you submit work that used this tool to a journal, conference, or institution, you must disclose AI assistance. The form of disclosure varies by publisher — check their current policy.
- If your institution has an AI use policy that requires disclosure or approval, follow it. This tool does not exempt you from institutional rules.
- Citing "AI-assisted literature review" without naming the tool and describing its role is insufficient disclosure at most venues.

---

## 2. Verification Is Not Optional

This system retrieves paper metadata from APIs and passes it to an LLM. **Neither the APIs nor the LLM are authoritative sources for the claims in papers.** The system can:

- Surface papers you might not have found with manual search
- Provide structured summaries of abstracts
- Identify thematic patterns across papers

The system cannot:

- Verify that summaries accurately represent the full paper
- Detect retracted papers reliably (retraction notices are not propagated quickly across databases)
- Assess methodology quality beyond what appears in the abstract
- Replace reading the papers

**Before citing any paper from this system's output:**

1. Retrieve the actual paper (not just the metadata)
2. Read the abstract and relevant sections
3. Check the paper has not been retracted (use the publisher's DOI link, PubMed, or Retraction Watch)
4. Verify the LLM summary reflects what the paper actually says

The human review gate in this workflow is there for a reason. Use it.

---

## 3. LLM Hallucination Risk

Large language models can hallucinate — generating plausible-sounding but false content. In this workflow, hallucination risk is highest in:

- **Analysis summaries:** The LLM may attribute claims to a paper that are not in the abstract.
- **Citation formatting:** The LLM may alter author names, publication years, or journal names.
- **Research gap synthesis:** The LLM may identify gaps that reflect training data biases rather than actual gaps in the literature.

Mitigation steps taken in this system:
- Paper IDs are included in every LLM analysis prompt to anchor the response
- Each analysis requests an `innovation_score` and `relevance_score` to help filter low-confidence results
- The synthesis explicitly asks the LLM to distinguish between "well-established findings" and "contested claims"

Mitigation steps you must take:
- Do not use LLM-generated citations without checking them against the original DOI
- Do not quote from LLM analysis summaries without reading the source paper
- Treat LLM-generated research gap analysis as a starting point for investigation, not a conclusion

---

## 4. Copyright and Database Terms of Service

**ArXiv:** Papers are freely available. The ArXiv API is explicitly available for programmatic access. However, copyright in individual papers belongs to the authors (or in some cases, their employers). Using abstracts for research purposes is generally fair use, but republishing full text is not.

**CrossRef:** The CrossRef metadata API is freely available for research use. CrossRef's open access content is available under various licenses — check individual papers.

**PubMed/NCBI:** NCBI E-utilities are freely available for research use. PubMed Central (PMC) has open access articles available for text mining under its stated terms.

**OpenAlex:** OpenAlex data is released under CC0 (public domain dedication). The API is freely available.

**Semantic Scholar:** The Semantic Scholar API is freely available for research. Full-text access varies by paper.

**What this means:**
- Programmatic search and abstract retrieval for research purposes is covered by all of these services' terms.
- Storing or redistributing large volumes of full-text paper content may not be.
- When using PDF extraction via the document processor, verify the paper is open access before automated full-text extraction.

---

## 5. Prompt Injection

Academic papers may contain text in their titles, abstracts, or keywords that attempts to manipulate AI systems. This is not hypothetical — it has been demonstrated in research settings.

This system mitigates prompt injection by:
- Embedding paper content in structured JSON format rather than directly in natural language prompts
- Using system-role instructions to establish the analysis task before user-role paper content
- Not using retrieved paper content as part of system prompts

Residual risk: sufficiently crafted academic abstracts could still attempt to influence LLM outputs. If you notice unusual or off-topic content in LLM analysis outputs, check the source paper's abstract for suspicious patterns.

---

## 6. Bias in Automated Literature Review

Automated literature review inherits the biases of:

1. **Database coverage:** ArXiv skews toward STEM. PubMed skews toward biomedical. CrossRef skews toward published, English-language journals. Papers from Global South institutions are systematically underrepresented in citation-based rankings.

2. **LLM training data:** The LLM may be more familiar with high-citation anglophone research and may undervalue or mischaracterize papers from other traditions.

3. **Citation-count sorting:** Papers are sorted by citation count descending. This systematically privileges older papers and well-known authors. A foundational 2004 paper will rank above a 2024 paper with equally important findings.

4. **Keyword-based retrieval:** The query refiner generates keyword queries. This can miss papers that use different terminology for the same concept, particularly across disciplinary traditions.

Mitigation:
- Treat the output as a starting point, not a complete review
- Manually search for recent papers (< 2 years old)
- If the topic has non-anglophone research traditions, manually search databases specific to those traditions
- Include `exclusion_terms` in your query to filter irrelevant results, and `keywords_override` to force inclusion of key terms

---

## 7. What to Cite and What Not to Cite

**You may cite** papers that this system identified, once you have:
- Located and read the actual paper
- Verified the metadata (title, authors, year, journal) against the paper itself
- Confirmed the paper supports the claim you are making

**Do not cite** anything solely on the basis of this system's output without reading the source. The LLM analysis summary is a research aid, not a primary source.

**Do not cite "this tool"** as a source for factual claims. The system retrieves metadata from public databases — cite the databases or the original papers.

---

## 8. Data Retention and Privacy

This system does not send your research topic or any retrieved paper data to third parties beyond:
- The LLM provider you configure (your research topic and paper abstracts are sent for analysis)
- The scholarly databases you query (your search queries are sent to ArXiv, CrossRef, PubMed, OpenAlex, Semantic Scholar)

If your research topic is sensitive or unpublished, consider:
- Using a local LLM (Ollama) to avoid sending the topic to any third-party API
- Being aware that search queries to public databases may be logged by those services

Report files are stored locally in `OUTPUT_DIR`. They contain paper metadata and AI-generated analysis. Handle them according to your institution's data retention policy.
