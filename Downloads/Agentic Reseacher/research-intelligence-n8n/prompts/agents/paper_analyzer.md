# Paper Analyzer Agent — System Prompt

**Purpose:** Documents the system prompt used in the `Analyze Paper` node. Processes one paper at a time and returns structured analysis as JSON.

---

## System prompt

```
You are an expert academic paper analyst. Your task is to analyze the provided academic paper and return a structured analysis as valid JSON.

HONESTY REQUIREMENTS:
- Base your analysis ONLY on the provided metadata and abstract
- If the abstract is missing or very short, populate analysis fields with appropriate null values or empty arrays
- Do NOT invent research results, datasets, or findings
- Do NOT fabricate evaluation scores or specific metrics not mentioned in the abstract
- If you are uncertain about a field, use "Could not determine from available metadata" rather than guessing
- innovation_score and relevance_score are your honest estimates based on the abstract quality and apparent contribution

CRITICAL: Include the paper_id field in your response exactly as provided in the user message. This is used for data matching.

Output ONLY valid JSON. No markdown. No code fences. No explanatory text.
```

---

## User message template

```
Analyze this paper and return exactly this JSON structure:

{
  "paper_id": "[PAPER_ID_HERE]",
  "paper_category": "",
  "research_problem": "",
  "methodology": "",
  "datasets_used": [],
  "evaluation_metrics": [],
  "key_findings": [],
  "strengths": [],
  "limitations": [],
  "future_work": [],
  "innovation_score": 5,
  "relevance_score": 5,
  "summary": ""
}

Field guidance:
- paper_category: One of: Empirical Study, Survey/Review, Theoretical, Methodological, Applied/Case Study, Dataset Paper, Position Paper
- research_problem: The specific problem this paper addresses (1-2 sentences)
- methodology: The main research approach or technique used
- datasets_used: Array of named datasets mentioned in abstract
- evaluation_metrics: Array of evaluation criteria mentioned
- key_findings: Array of 2-5 main results or contributions
- strengths: Array of apparent methodological or contribution strengths
- limitations: Array of stated or apparent limitations
- future_work: Array of future directions mentioned
- innovation_score: 1-10 (1=incremental improvement, 10=major novel contribution)
- relevance_score: 1-10 (1=tangentially related, 10=directly addresses the research topic)
- summary: 2-3 sentence neutral summary

Title: [TITLE]
Authors: [AUTHORS]
Year: [YEAR]
Journal: [JOURNAL]
Abstract: [ABSTRACT]
```

---

## Fallback behaviour

If the LLM response cannot be parsed as JSON, the `Merge Paper + Analysis` node uses this fallback structure:

```json
{
  "paper_id": "[paper id]",
  "paper_category": "Unclassified",
  "research_problem": "Could not extract",
  "methodology": "Could not extract",
  "datasets_used": [],
  "evaluation_metrics": [],
  "key_findings": ["Analysis failed — see abstract for details"],
  "strengths": [],
  "limitations": [],
  "future_work": [],
  "innovation_score": 5,
  "relevance_score": 5,
  "summary": "[first 200 chars of abstract]"
}
```

---

## Matching fix

The `paper_id` field being echoed back by the LLM is the key fix for paper-analysis matching. The `Merge Paper + Analysis` node:

1. First tries `item.pairedItem.item` index (most reliable in n8n)
2. If the analysis response contains a `paper_id` that differs from the paired paper, searches all split papers for the matching ID
3. Falls back to index-based matching as last resort

This three-layer approach handles edge cases from batched API processing.
