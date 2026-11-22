/**
 * IEEE-Style HTML Report Generator — Engineering-depth edition
 */

function generateHTMLReport({ topic, review = {}, papers = [], keywords = [] }) {
  const esc = t => !t ? '' : String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const years = papers.map(p => parseInt(p.year)).filter(y => !isNaN(y) && y > 1990 && y <= new Date().getFullYear() + 2);
  const minYear = years.length ? Math.min(...years) : new Date().getFullYear() - 7;
  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
  const totalCitations = papers.reduce((s, p) => s + (p.citations || 0), 0);
  const sources = [...new Set(papers.map(p => p.source))];
  const topCited = [...papers].sort((a,b) => (b.citations||0)-(a.citations||0))[0];

  // Source distribution bar
  function sourceDistribution() {
    const counts = {};
    papers.forEach(p => { counts[p.source] = (counts[p.source] || 0) + 1; });
    const max = Math.max(...Object.values(counts));
    const colors = { ArXiv:'#e57373', CrossRef:'#64b5f6', PubMed:'#81c784', OpenAlex:'#ffb74d', 'Semantic Scholar':'#ce93d8', DBLP:'#4dd0e1' };
    return Object.entries(counts).map(([src, n]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:8pt;font-family:Arial">
        <span style="width:100px;text-align:right;color:#555">${esc(src)}</span>
        <div style="background:${colors[src]||'#aaa'};height:14px;width:${Math.round(n/max*160)}px;border-radius:2px"></div>
        <span style="color:#333;font-weight:600">${n}</span>
      </div>`).join('');
  }

  function sectionsHTML() {
    if (!Array.isArray(review.thematic_sections)) return '';
    return review.thematic_sections.map((s, i) => {
      const roman = ['III','IV','V','VI','VII','VIII','IX','X'][i] || String(i+3);
      return `
        <h2>${roman}. ${esc((s.title||'').toUpperCase())}</h2>
        <p>${esc(s.content||'')}</p>
        ${s.key_insights ? `<div class="insight-box"><strong>Key Insight:</strong> ${esc(s.key_insights)}</div>` : ''}`;
    }).join('');
  }

  function taxonomyHTML() {
    if (!Array.isArray(review.taxonomy)) return '';
    return `<h2>TAXONOMY</h2><div class="taxonomy-box">${
      review.taxonomy.map(t => `<div style="margin-bottom:5pt"><strong style="color:#0d47a1">${esc(t.category)}:</strong> ${esc(t.description)}</div>`).join('')
    }</div>`;
  }

  function performanceHighlightsHTML() {
    const ph = review.performance_highlights;
    if (!Array.isArray(ph) || ph.length === 0) return '';
    return `
      <h2>PERFORMANCE HIGHLIGHTS</h2>
      <table class="perf-table">
        <thead><tr><th>Paper</th><th>Key Result</th><th>Context / Baseline</th></tr></thead>
        <tbody>${ph.map(h => `<tr>
          <td>${esc(h.paper)}</td>
          <td><strong>${esc(h.result)}</strong></td>
          <td>${esc(h.context)}</td>
        </tr>`).join('')}</tbody>
      </table>`;
  }

  function referencesHTML() {
    return papers.slice(0, 30).map((p, i) => `
      <div class="reference-item">
        <span class="ref-num">[${i+1}]</span>
        <span>${esc(Array.isArray(p.authors) ? p.authors.join(', ') : p.authors)}, &ldquo;${esc(p.title)},&rdquo; <em>${esc(p.journal||p.source)}</em>, ${esc(p.year)}${p.doi ? `, DOI: ${esc(p.doi)}` : ''}. [${esc(p.source)}]${p.citations ? ` · ${p.citations} citations` : ''}</span>
      </div>`).join('');
  }

  function matrixHTML() {
    const rows = papers.slice(0, 25).map(p => ({
      title: p.title, authors: Array.isArray(p.authors) ? p.authors.slice(0,2).join(', ') : p.authors,
      year: p.year, source: p.source, citations: p.citations || 0,
      methodology: p.analysis?.methodology || '—',
      performance: p.analysis?.performance || '—',
      implementation: p.analysis?.implementation || '—',
      complexity: p.analysis?.complexity || '—',
      findings: p.analysis?.findings || (p.abstract?.substring(0,120)+'…'),
      gaps: p.analysis?.gaps || '—',
      repro: p.analysis?.reproducibility || 'not-stated'
    }));

    const reproColor = r => ({ 'open-source':'#2e7d32','data-available':'#1565c0','proprietary':'#b71c1c','not-stated':'#757575' })[r] || '#757575';

    return `
      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width:18%">Publication</th>
            <th style="width:5%">Year</th>
            <th style="width:7%">Source</th>
            <th style="width:5%">Cited</th>
            <th style="width:13%">Methodology</th>
            <th style="width:10%">Performance</th>
            <th style="width:10%">Implementation</th>
            <th style="width:8%">Complexity</th>
            <th style="width:14%">Key Findings</th>
            <th style="width:5%">Repro</th>
          </tr>
        </thead>
        <tbody>${rows.map(r => `
          <tr>
            <td><strong>${esc(r.title)}</strong><br><small style="color:#666">${esc(r.authors)}</small></td>
            <td>${esc(r.year)}</td>
            <td><span style="font-size:7pt">${esc(r.source)}</span></td>
            <td style="text-align:center;font-weight:600;color:#0d47a1">${r.citations}</td>
            <td>${esc(r.methodology)}</td>
            <td style="font-weight:600;color:#1a237e">${esc(r.performance)}</td>
            <td>${esc(r.implementation)}</td>
            <td>${esc(r.complexity)}</td>
            <td>${esc(r.findings)}</td>
            <td><span style="font-size:7pt;color:${reproColor(r.repro)};font-weight:600">${esc(r.repro)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Systematic Literature Review: ${esc(topic)}</title>
<style>
  body { font-family:"Times New Roman",Times,serif; color:#111; line-height:1.45; background:#f4f6f8; margin:0; padding:20px; }
  .page { background:#fff; max-width:980px; margin:0 auto 30px; padding:50px; box-shadow:0 4px 14px rgba(0,0,0,.1); border-radius:4px; }
  .page-header { border-bottom:2px solid #000; font-size:7.5pt; text-transform:uppercase; letter-spacing:1px; padding-bottom:4px; margin-bottom:24px; color:#444; font-family:Arial; }
  h1.title { font-size:19pt; text-align:center; margin-bottom:8pt; text-transform:uppercase; }
  .authors-block { text-align:center; font-size:9.5pt; color:#333; margin-bottom:22px; font-family:Arial }
  .abstract-box { border:1px solid #c5d0dc; background:#f8fafc; padding:14px 18px; border-radius:4px; margin-bottom:20px; }
  .stats-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:22px; }
  .stat-box { background:#f0f4f8; border:1px solid #d9e2ec; padding:10px; text-align:center; border-radius:4px; }
  .stat-number { font-size:17pt; font-weight:700; color:#0d47a1; }
  .stat-label { font-size:7pt; text-transform:uppercase; color:#555; font-family:Arial; margin-top:2px; }
  .two-col { column-count:2; column-gap:30px; text-align:justify; font-size:9.5pt; }
  h2 { font-size:9.5pt; text-transform:uppercase; border-bottom:1px solid #333; padding-bottom:2px; margin-top:16pt; margin-bottom:5pt; break-after:avoid; font-family:Arial; }
  p { margin-top:0; margin-bottom:7pt; text-indent:14pt; }
  .insight-box { background:#f0f4ff; border-left:3px solid #0d47a1; padding:7pt 10pt; margin:7pt 0; font-size:9pt; }
  .taxonomy-box { background:#f5f7fa; border-left:3px solid #0d47a1; padding:8pt 10pt; margin:7pt 0; font-size:9pt; }
  .gap-box { background:#fff8f8; border-left:3px solid #c62828; padding:8pt 10pt; margin:7pt 0; font-size:9pt; }
  .future-box { background:#f4faf4; border-left:3px solid #2e7d32; padding:8pt 10pt; margin:7pt 0; font-size:9pt; }
  .reference-item { font-size:8pt; margin-bottom:5pt; text-indent:-18pt; padding-left:18pt; }
  .ref-num { font-weight:700; margin-right:4pt; }
  .perf-table { width:100%; border-collapse:collapse; font-size:8.5pt; font-family:Arial; margin:10px 0 14px; }
  .perf-table th, .perf-table td { border:1px solid #ccc; padding:5pt 7pt; vertical-align:top; }
  .perf-table th { background:#0d47a1; color:#fff; }
  .perf-table tr:nth-child(even) { background:#f9fbfd; }
  .matrix-section { max-width:1400px; overflow-x:auto; }
  .matrix-table { width:100%; border-collapse:collapse; font-size:7.5pt; font-family:Arial; margin-top:12px; }
  .matrix-table th, .matrix-table td { border:1px solid #ccc; padding:5pt 6pt; text-align:left; vertical-align:top; }
  .matrix-table th { background:#0d47a1; color:#fff; font-size:7pt; text-transform:uppercase; }
  .matrix-table tr:nth-child(even) { background:#f9fbfd; }
  @media print { body{background:transparent;padding:0} .page{box-shadow:none;margin:0;padding:18mm;page-break-after:always} }
</style>
</head>
<body>

<div class="page">
  <div class="page-header">IEEE TRANSACTIONS — SYSTEMATIC LITERATURE REVIEW &amp; META-ANALYSIS · ${new Date().getFullYear()}</div>
  <h1 class="title">${esc(topic)}</h1>
  <div class="authors-block">
    <strong>Agentic Multi-Database Literature Survey</strong><br>
    <span>ArXiv &bull; CrossRef &bull; PubMed &bull; OpenAlex &bull; Semantic Scholar &bull; DBLP</span>
  </div>

  <div class="abstract-box">
    <p style="text-indent:0"><span style="font-weight:700;font-style:italic">Abstract</span> &mdash; ${esc(review.executive_summary || `Systematic review of ${papers.length} publications on "${topic}".`)}</p>
    <p style="text-indent:0;font-size:8.5pt;font-style:italic;margin-bottom:0"><strong>Index Terms</strong> &mdash; ${esc(keywords.length ? keywords.join(', ') : topic)}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-box"><div class="stat-number">${papers.length}</div><div class="stat-label">Papers Analyzed</div></div>
    <div class="stat-box"><div class="stat-number">${maxYear - minYear + 1}</div><div class="stat-label">Year Span (${minYear}–${maxYear})</div></div>
    <div class="stat-box"><div class="stat-number">${sources.length}</div><div class="stat-label">Databases</div></div>
    <div class="stat-box"><div class="stat-number">${totalCitations.toLocaleString()}</div><div class="stat-label">Total Citations</div></div>
    <div class="stat-box"><div class="stat-number">${Math.round(totalCitations / Math.max(papers.length,1))}</div><div class="stat-label">Avg Citations</div></div>
  </div>

  ${topCited ? `<div style="font-size:8.5pt;font-family:Arial;padding:8px 12px;background:#e8f0fe;border-radius:4px;margin-bottom:18px">
    <strong>Most Cited:</strong> "${esc(topCited.title)}" (${esc(topCited.year)}) — ${topCited.citations} citations [${esc(topCited.source)}]
  </div>` : ''}

  <div style="margin-bottom:20px">
    <div style="font-size:8pt;font-family:Arial;font-weight:700;color:#444;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Source Distribution</div>
    ${sourceDistribution()}
  </div>

  <div class="two-col">
    <h2>I. INTRODUCTION</h2>
    <p>${esc(review.introduction || `This survey synthesises recent scholarship on "${topic}".`)}</p>

    <h2>II. BACKGROUND & THEORETICAL FOUNDATIONS</h2>
    <p>${esc(review.background || `Foundational concepts in "${topic}" span both theoretical and applied dimensions.`)}</p>

    ${sectionsHTML()}
    ${taxonomyHTML()}
    ${performanceHighlightsHTML()}

    <h2>CRITICAL RESEARCH GAPS</h2>
    <div class="gap-box">
      ${(Array.isArray(review.research_gaps) ? review.research_gaps : ['Standardisation and reproducibility remain open.'])
        .map(g => `<p style="text-indent:0;margin-bottom:4pt"><strong>&bull;</strong> ${esc(g)}</p>`).join('')}
    </div>

    <h2>FUTURE DIRECTIONS</h2>
    <div class="future-box">
      ${(Array.isArray(review.future_directions) ? review.future_directions : ['Large-scale replication and open benchmarks.'])
        .map(d => `<p style="text-indent:0;margin-bottom:4pt"><strong>&rarr;</strong> ${esc(d)}</p>`).join('')}
    </div>

    <h2>CONCLUSION</h2>
    <p>${esc(review.conclusion || `This review maps the state of "${topic}" and charts the most consequential open problems.`)}</p>

    <h2>REFERENCES</h2>
    <div>${referencesHTML()}</div>
  </div>
</div>

<div class="page matrix-section">
  <div class="page-header">APPENDIX — SYSTEMATIC COMPARISON MATRIX (${papers.length} PAPERS)</div>
  <p style="font-size:9pt;text-indent:0;color:#555;margin-bottom:12px">Full comparative matrix: methodology, performance results, implementation details, computational complexity, and reproducibility status across all reviewed works.</p>
  ${matrixHTML()}
</div>

</body>
</html>`;
}

module.exports = { generateHTMLReport };
