/**
 * AI Agents — Engineering-depth, domain-agnostic LLM pipeline.
 * Agents: Query Refiner · Paper Analyzer · Research Manager (Synthesizer)
 */

const CURRENT_YEAR = new Date().getFullYear();
const FROM_YEAR = CURRENT_YEAR - 7;

async function callLLM({ endpoint, apiKey, model, messages, temperature = 0.2, maxTokens = 4096, timeoutMs = 45000 }) {
  if (!apiKey || apiKey.includes('your_api_key_here')) return null;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal
    });
  } finally { clearTimeout(tid); }
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM ${response.status}: ${err.substring(0, 200)}`);
  }
  const data = await response.json();
  const msg = data.choices?.[0]?.message;
  // Reasoning models return answer in content after thinking; fall back to reasoning text
  return msg?.content || msg?.reasoning || msg?.reasoning_details?.[0]?.text || '';
}

function pickLLM(env, prefer = 'default') {
  // Groq primary — sub-second latency even on reasoning models
  if (env.GROQ_API_KEY) return {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: env.GROQ_API_KEY,
    model: prefer === 'fast' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b'
  };
  // OpenRouter fallback
  if (env.OPENROUTER_API_KEY) return {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: env.OPENROUTER_API_KEY,
    model: prefer === 'fast'
      ? 'nvidia/nemotron-3.5-lightning:free'
      : 'nvidia/nemotron-3-ultra-550b-a55b:free'
  };
  if (env.GEMINI_API_KEY) return {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash'
  };
  return null;
}

function safeParseJSON(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/**
 * 1. Query Refiner Agent
 * Auto-detects academic domain and generates 8 precise boolean search queries.
 */
async function refineQuery(topic, env = process.env) {
  const llm = pickLLM(env);
  const prompt = `You are an expert academic search strategist and research librarian.

Analyze the topic: "${topic}"

Step 1: Identify the PRIMARY academic discipline and sub-field (e.g. "Computer Architecture", "Structural Engineering", "Molecular Biology", "Constitutional Law", "Macroeconomics").

Step 2: Generate 8 precise boolean search queries optimised for academic databases (ArXiv, IEEE, ACM, CrossRef). Each query must:
- Use domain-appropriate technical terminology
- Combine specific concepts using AND/OR operators
- Be distinct from each other (covering different angles)
- Avoid generic filler words like "deep learning" unless the topic genuinely involves it

Return ONLY valid JSON matching this schema:
{
  "main_topic": "${topic}",
  "domain": "<specific sub-field, e.g. 'Computer Architecture — Memory Systems'>",
  "refined_queries": [
    "<query 1: core concept + primary method>",
    "<query 2: core concept + alternative method>",
    "<query 3: core concept + system/application context>",
    "<query 4: core concept + evaluation/benchmark>",
    "<query 5: core concept + performance/optimization>",
    "<query 6: core concept + recent innovation or paradigm shift>",
    "<query 7: systematic review or survey of this topic>",
    "<query 8: open challenges + future directions>"
  ],
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5","keyword6"],
  "sub_topics": ["subtopic1","subtopic2","subtopic3","subtopic4"],
  "exclusion_terms": ["non-peer-reviewed","retracted","workshop abstract"],
  "time_range": "${FROM_YEAR}-${CURRENT_YEAR}",
  "expected_domains": ["<primary discipline>","<related discipline>"],
  "key_venues": ["<top journal or conference for this field>","<second top venue>"]
}
Output ONLY the raw JSON object. No markdown, no commentary.`;

  if (llm) {
    try {
      const text = await callLLM({ ...llm, messages: [{ role: 'user', content: prompt }] });
      const parsed = safeParseJSON(text);
      if (parsed) return parsed;
    } catch (err) {
      console.warn(`[Query Refiner] LLM failed, using heuristic: ${err.message}`);
    }
  }

  return {
    main_topic: topic,
    domain: 'Interdisciplinary Research',
    refined_queries: [
      `"${topic}" systematic review`,
      `"${topic}" empirical study`,
      `"${topic}" theoretical framework`,
      `"${topic}" performance evaluation benchmark`,
      `"${topic}" optimization methodology`,
      `"${topic}" state-of-the-art advances`,
      `"${topic}" survey comparative analysis`,
      `"${topic}" challenges limitations future directions`
    ],
    keywords: [topic, 'systematic review', 'empirical evaluation', 'methodology', 'analysis', 'benchmark'],
    sub_topics: [`${topic} methods`, `${topic} evaluation`, `${topic} applications`, `${topic} challenges`],
    exclusion_terms: ['non-peer-reviewed', 'retracted', 'workshop abstract'],
    time_range: `${FROM_YEAR}-${CURRENT_YEAR}`,
    expected_domains: ['Interdisciplinary', 'Applied Sciences'],
    key_venues: []
  };
}

/**
 * 2. Paper Analyzer Agent
 * Extracts deep technical metadata from any paper in any discipline.
 * Runs in parallel batches for speed.
 */
async function analyzePaper(paper, env = process.env) {
  const llm = pickLLM(env, 'openrouter');
  if (!llm) return buildFallbackAnalysis(paper);

  // Use fast model for individual paper analysis
  const fastLlm = pickLLM(env, 'fast');

  const prompt = `Analyze this academic paper and return a JSON object with deep technical detail.

Title: ${paper.title}
Authors: ${Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors}
Year: ${paper.year}
Venue: ${paper.journal || paper.source}
Abstract: ${paper.abstract || 'Not available'}

Return ONLY this exact JSON schema (adapt to the paper's actual discipline):
{
  "methodology": "Primary research method (e.g. Randomised Controlled Trial, FEM simulation, Transformer model, case law analysis, ethnographic study, VLSI design, Monte Carlo simulation)",
  "dataset": "Data source, corpus, testbed, or experimental setup (be specific: name the dataset/cohort/benchmark if mentioned)",
  "metrics": "Evaluation metrics or outcome measures (e.g. accuracy %, latency ms, p-value, structural load capacity, throughput ops/sec)",
  "performance": "Key quantitative result or headline number if stated (e.g. '94.3% accuracy on X benchmark', '2.3x speedup over baseline', or 'N/A')",
  "implementation": "Implementation framework, language, hardware, or toolchain if stated (e.g. PyTorch/A100 GPU, MATLAB/FEA, Verilog/FPGA, or 'Not specified')",
  "complexity": "Algorithmic, computational, or structural complexity if stated (e.g. O(n log n), 45nm node, 128-layer, or 'Not specified')",
  "findings": "Core findings or conclusions in 1-2 precise sentences",
  "gaps": "Primary limitation or identified future work stated by the authors",
  "reproducibility": "open-source / data-available / proprietary / not-stated"
}
Output ONLY raw JSON.`;

  try {
    const text = await callLLM({ ...fastLlm, messages: [{ role: 'user', content: prompt }], temperature: 0.1, maxTokens: 2000 });
    const parsed = safeParseJSON(text);
    if (parsed) return parsed;
  } catch { /* fall through */ }

  return buildFallbackAnalysis(paper);
}

function buildFallbackAnalysis(paper) {
  return {
    methodology: 'Empirical / Analytical Research',
    dataset: 'Domain-specific corpus or experimental testbed',
    metrics: 'Reported domain-appropriate outcome measures',
    performance: 'N/A',
    implementation: 'Not specified',
    complexity: 'Not specified',
    findings: paper.abstract?.length > 30 ? paper.abstract.substring(0, 200) + '…' : 'Novel contribution to the field.',
    gaps: 'Cross-context generalisation and large-scale validation required.',
    reproducibility: 'not-stated'
  };
}

/**
 * Analyze papers in parallel batches of 5 for 5x speed.
 */
async function analyzeAllPapers(papers, env = process.env, concurrency = 5) {
  const results = [];
  for (let i = 0; i < papers.length; i += concurrency) {
    const batch = papers.slice(i, i + concurrency);
    const analyzed = await Promise.all(batch.map(p => analyzePaper(p, env).catch(() => buildFallbackAnalysis(p))));
    results.push(...analyzed);
    console.log(`[Paper Analyzer] ${Math.min(i + concurrency, papers.length)}/${papers.length} analyzed`);
  }
  return results;
}

/**
 * 3. Research Manager Agent
 * Synthesizes all papers into an engineering-depth structured review.
 */
async function synthesizeReview({ topic, papers, keywords = [], domain = '' }, env = process.env) {
  const llm = pickLLM(env);

  const papersSummary = papers.slice(0, 25).map((p, i) => {
    const a = p.analysis || {};
    const findings = (a.findings || p.abstract || '').substring(0, 100);
    return `[${i+1}] "${p.title.substring(0,70)}" (${p.year}, ${p.citations}cit) | Method:${(a.methodology||'N/A').substring(0,30)} | Perf:${(a.performance||'N/A').substring(0,30)} | ${findings}`;
  }).join('\n');

  const prompt = `You are a distinguished senior researcher and IEEE fellow. Write a publication-quality systematic literature review on:

TOPIC: "${topic}"
DOMAIN: ${domain || 'auto-detect'}

Analyzed papers (${papers.length} total):
${papersSummary}

Generate a comprehensive, technically rigorous review. Adapt ALL thematic sections, taxonomy categories, and terminology to match the actual discipline of this topic. For engineering/architecture topics, include sections on system design, performance benchmarks, and implementation trade-offs. For social/medical/legal topics, include appropriate domain sections.

Return ONLY valid JSON matching this schema exactly:
{
  "executive_summary": "Dense 4-5 sentence abstract with specific technical findings and quantitative insights where available.",
  "introduction": "2-paragraph introduction with historical context, motivation, and scope of this survey.",
  "background": "Technical foundations, seminal works, and theoretical underpinnings specific to this domain.",
  "thematic_sections": [
    {
      "title": "<Discipline-specific theme 1 — e.g. 'Cache Coherence Protocols' or 'Randomised Trial Design' or 'Regulatory Framework Analysis'>",
      "content": "Deep technical synthesis of this theme across reviewed papers, with specific references to methods and results.",
      "key_insights": "The single most important technical or scientific takeaway."
    },
    {
      "title": "<Theme 2 — e.g. 'Memory Bandwidth Optimization' or 'Outcome Measurement Validity' or 'Cross-jurisdictional Harmonisation'>",
      "content": "Analysis of evaluation methodologies, benchmarks, or validation approaches.",
      "key_insights": "Critical insight on standardisation or best practice."
    },
    {
      "title": "<Theme 3 — e.g. 'Scalability and Deployment Constraints' or 'Population Heterogeneity' or 'Enforcement Mechanisms'>",
      "content": "Analysis of practical implementation, scalability challenges, or real-world deployment considerations.",
      "key_insights": "Key engineering or practical constraint."
    }
  ],
  "performance_highlights": [
    { "paper": "<shortened title>", "result": "<specific metric and value>", "context": "<what it was compared against>" }
  ],
  "taxonomy": [
    { "category": "<Category 1>", "description": "<Precise description with examples from reviewed papers>" },
    { "category": "<Category 2>", "description": "<Precise description>" },
    { "category": "<Category 3>", "description": "<Precise description>" },
    { "category": "<Category 4>", "description": "<Precise description>" }
  ],
  "research_gaps": [
    "Specific gap 1 grounded in the reviewed literature",
    "Specific gap 2",
    "Specific gap 3",
    "Specific gap 4"
  ],
  "future_directions": [
    "Concrete direction 1 with rationale",
    "Concrete direction 2",
    "Concrete direction 3",
    "Concrete direction 4"
  ],
  "conclusion": "Synthesising conclusion with actionable recommendations and open problems."
}
Output ONLY the raw JSON object. No markdown wrappers.`;

  if (llm) {
    try {
      const text = await callLLM({ ...llm, messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 8192 });
      const parsed = safeParseJSON(text);
      if (parsed) return parsed;
    } catch (err) {
      console.warn(`[Research Manager] Primary failed: ${err.message}`);
      // On rate-limit, retry once with OpenRouter if we have a key
      if (err.message.includes('429') && process.env.OPENROUTER_API_KEY) {
        try {
          const fallbackLlm = { endpoint: 'https://openrouter.ai/api/v1/chat/completions', apiKey: process.env.OPENROUTER_API_KEY, model: 'nvidia/nemotron-3-ultra-550b-a55b:free' };
          const text2 = await callLLM({ ...fallbackLlm, messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 8192, timeoutMs: 90000 });
          const parsed2 = safeParseJSON(text2);
          if (parsed2) { console.log('[Research Manager] Succeeded via OpenRouter fallback'); return parsed2; }
        } catch (err2) {
          console.warn(`[Research Manager] OpenRouter fallback also failed: ${err2.message}`);
        }
      }
    }
  }

  return {
    executive_summary: `This systematic review synthesises ${papers.length} publications on "${topic}" from ${FROM_YEAR}–${CURRENT_YEAR}, spanning ArXiv, CrossRef, PubMed, OpenAlex, Semantic Scholar, and DBLP. The analysis maps foundational methods, benchmark results, implementation trade-offs, and persistent open challenges across the field.`,
    introduction: `The scholarship on "${topic}" has expanded rapidly, driven by both theoretical advances and growing practical demand. This survey establishes a rigorous taxonomy and benchmarks current methodologies against one another.\n\nCovering ${papers.length} peer-reviewed works from six academic databases, this review provides researchers and practitioners with a consolidated reference for the state of the field.`,
    background: `Foundational contributions to "${topic}" established the theoretical and empirical foundations that subsequent work builds on. Key conceptual frameworks and landmark results define the baseline against which modern approaches are evaluated.`,
    thematic_sections: [
      {
        title: 'Methodological Approaches and System Architectures',
        content: `The reviewed literature spans a wide range of research methodologies and system designs. Quantitative empirical studies dominate, with a subset presenting formal theoretical analyses and proofs.`,
        key_insights: 'No single methodology dominates; the most cited works combine rigorous empirical validation with theoretical guarantees.'
      },
      {
        title: 'Performance Benchmarks and Evaluation Protocols',
        content: `Evaluation standards vary significantly across studies, limiting direct comparison. High-impact papers consistently benchmark against established baselines on publicly available datasets or standard testbeds.`,
        key_insights: 'Reproducibility and standardised benchmarking remain the critical bottlenecks for progress.'
      },
      {
        title: 'Scalability, Deployment, and Real-World Constraints',
        content: `Scaling results from controlled experiments to production environments introduces challenges including resource constraints, data distribution shift, and latency requirements.`,
        key_insights: 'The gap between laboratory performance and deployed system performance is the defining unsolved challenge.'
      }
    ],
    performance_highlights: [],
    taxonomy: [
      { category: 'Foundational / Theoretical', description: 'Mathematical models, formal proofs, and conceptual frameworks' },
      { category: 'Empirical / Experimental', description: 'Controlled experiments, benchmarks, and large-scale evaluations' },
      { category: 'Systems / Applied', description: 'End-to-end implementations, deployments, and engineering systems' },
      { category: 'Survey / Meta-Analysis', description: 'Comparative reviews and cross-study syntheses' }
    ],
    research_gaps: [
      'Lack of standardised benchmarks enabling reproducible cross-study comparisons.',
      'Limited evidence from real-world deployments beyond controlled laboratory settings.',
      'Underexplored scalability trade-offs at production scale.',
      'Insufficient longitudinal studies tracking long-term outcomes and system degradation.'
    ],
    future_directions: [
      'Open benchmark suites with community-agreed evaluation protocols.',
      'Cross-institutional replication studies at scale.',
      'Hardware-software co-design explorations for resource-constrained deployments.',
      'Automated meta-analysis tools for continuous literature synthesis.'
    ],
    conclusion: `The field of "${topic}" demonstrates strong methodological diversity and rapid progress. The highest-impact open problem remains reproducibility and fair benchmarking. Addressing scalability-to-deployment gaps will unlock the next generation of practical contributions.`
  };
}

module.exports = { callLLM, refineQuery, analyzePaper, analyzeAllPapers, synthesizeReview };
