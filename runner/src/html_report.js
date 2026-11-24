/**
 * IEEE-Style HTML Report Generator — Chapter edition
 * Supports: chapter structure · inline citation anchors · figures/pictorial evidence · school logos
 */

let LOGO1 = '', LOGO2 = '';
try {
  const logos = require('../assets/logos');
  LOGO1 = logos.LOGO1 || '';
  LOGO2 = logos.LOGO2 || '';
} catch {}

function generateHTMLReport({
  topic,
  review = {},
  papers = [],
  allPapers = null,   // full dedup pool for references (up to 100); falls back to papers
  keywords = [],
  figures = [],
  reportMeta = {}
}) {
  // allPapers: entire deduplicated pool for the references section.
  // papers:    the AI-analysed subset used in the comparison matrix.
  const refPool = Array.isArray(allPapers) && allPapers.length > papers.length
    ? allPapers : papers;
  const esc = t => !t ? '' : String(t)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { year:'numeric', month:'long', day:'numeric' });
  const year = now.getFullYear();

  const years = papers.map(p => parseInt(p.year)).filter(y => !isNaN(y) && y > 1990 && y <= year + 2);
  const minYear = years.length ? Math.min(...years) : year - 7;
  const maxYear = years.length ? Math.max(...years) : year;
  const totalCitations = papers.reduce((s, p) => s + (p.citations || 0), 0);
  const sources = [...new Set(papers.map(p => p.source))];
  const topCited = [...papers].sort((a,b) => (b.citations||0)-(a.citations||0))[0];

  const institution = reportMeta.institution || 'SQI College of ICT · Caleb University, Imota, Lagos';
  const supervisors = reportMeta.supervisors || '';
  const reportNumber = reportMeta.reportNumber || `SLR-${year}-${String(now.getMonth()+1).padStart(2,'0')}`;

  /* ── Citation helpers ──────────────────────────────────────────────── */
  function refId(i) { return `ref-${i+1}`; }

  function inlineCite(indices) {
    if (!indices || !indices.length) return '';
    return '<sup class="cite">' +
      indices.map(i => `<a href="#${refId(i-1)}" class="cite-link">[${i}]</a>`).join(',') +
      '</sup>';
  }

  /* ── Figures ───────────────────────────────────────────────────────── */
  function figureHTML(fig, num) {
    if (!fig || !fig.src) return '';
    const caption = esc(fig.caption || `Figure ${num}`);
    const credit  = fig.credit ? `<span class="fig-credit">Source: ${esc(fig.credit)}</span>` : '';
    const url     = fig.url    ? ` <a href="${esc(fig.url)}" target="_blank" rel="noopener" class="fig-src-link">[link]</a>` : '';
    return `
      <figure class="report-figure" id="fig-${num}">
        <img src="${esc(fig.src)}" alt="${caption}" loading="lazy">
        <figcaption>
          <strong>Figure ${num}.</strong> ${caption}${url}
          ${credit}
        </figcaption>
      </figure>`;
  }

  function allFiguresHTML() {
    if (!figures.length) return '';
    return figures.map((f, i) => figureHTML(f, i + 1)).join('');
  }

  /* ── Source distribution bar ───────────────────────────────────────── */
  function sourceDistribution() {
    const counts = {};
    papers.forEach(p => { counts[p.source] = (counts[p.source] || 0) + 1; });
    const max = Math.max(...Object.values(counts), 1);
    const colors = {
      ArXiv:'#e57373', CrossRef:'#64b5f6', PubMed:'#81c784',
      OpenAlex:'#ffb74d', 'Semantic Scholar':'#ce93d8', DBLP:'#4dd0e1'
    };
    return Object.entries(counts).map(([src, n]) => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:8pt;font-family:Arial">
        <span style="width:110px;text-align:right;color:#555">${esc(src)}</span>
        <div style="background:${colors[src]||'#aaa'};height:14px;width:${Math.round(n/max*160)}px;border-radius:2px"></div>
        <span style="color:#333;font-weight:600">${n}</span>
      </div>`).join('');
  }

  /* ── Table of Contents ─────────────────────────────────────────────── */
  function buildTOC(sections) {
    const fixed = [
      'I. Introduction',
      'II. Background & Theoretical Foundations',
    ];
    const thematic = (sections || []).map((s, i) => {
      const roman = ['III','IV','V','VI','VII','VIII','IX','X'][i] || `${i+3}`;
      return `${roman}. ${(s.title||'').replace(/[<>&"']/g,'').substring(0,80)}`;
    });
    const tail = [
      'Taxonomy',
      'Performance Highlights',
      'Critical Research Gaps',
      'Future Directions',
      'Conclusion',
      'References',
    ];
    return [...fixed, ...thematic, ...tail].map((entry, i) => {
      const anchor = entry.replace(/[^A-Za-z0-9]+/g,'-').toLowerCase();
      return `<div class="toc-row">
        <a href="#${anchor}" class="toc-link">${esc(entry)}</a>
        <span class="toc-dots"></span>
        <span class="toc-pg">${i + 1}</span>
      </div>`;
    }).join('');
  }

  /* ── Thematic chapters ─────────────────────────────────────────────── */
  function sectionsHTML() {
    if (!Array.isArray(review.thematic_sections)) return '';
    return review.thematic_sections.map((s, i) => {
      const roman = ['III','IV','V','VI','VII','VIII','IX','X'][i] || String(i+3);
      const anchor = `${roman}-${(s.title||'').replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()}`.substring(0,60);
      const figForSection = figures.find(f => f.section === i);
      return `
        <div class="chapter-break" id="${anchor}">
          <h2>${roman}. ${esc((s.title||'').toUpperCase())}</h2>
          <div class="chapter-body">
            <p>${esc(s.content || '')}</p>
            ${figForSection ? figureHTML(figForSection, i+1) : ''}
            ${s.key_insights ? `<div class="insight-box"><span class="box-label">Key Insight</span>${esc(s.key_insights)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  /* ── Taxonomy ──────────────────────────────────────────────────────── */
  function taxonomyHTML() {
    if (!Array.isArray(review.taxonomy)) return '';
    return `
      <div class="chapter-break" id="taxonomy">
        <h2>TAXONOMY</h2>
        <div class="taxonomy-grid">
          ${review.taxonomy.map((t,i) => `
            <div class="taxonomy-cell">
              <div class="tax-num">${i+1}</div>
              <div>
                <strong class="tax-cat">${esc(t.category)}</strong>
                <p class="tax-desc">${esc(t.description)}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ── Performance highlights ────────────────────────────────────────── */
  function performanceHighlightsHTML() {
    const ph = review.performance_highlights;
    if (!Array.isArray(ph) || ph.length === 0) return '';
    return `
      <div class="chapter-break" id="performance-highlights">
        <h2>PERFORMANCE HIGHLIGHTS</h2>
        <table class="perf-table">
          <thead><tr><th>#</th><th>Paper</th><th>Key Result</th><th>Context / Baseline</th></tr></thead>
          <tbody>${ph.map((h,i) => `<tr>
            <td style="text-align:center;color:#0d47a1;font-weight:700">${i+1}</td>
            <td>${esc(h.paper)}</td>
            <td><strong style="color:#1a237e">${esc(h.result)}</strong></td>
            <td>${esc(h.context)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  /* ── References list ───────────────────────────────────────────────── */
  function referencesHTML() {
    return refPool.slice(0, 100).map((p, i) => {
      const authStr = esc(Array.isArray(p.authors) ? p.authors.join(', ') : (p.authors || 'Unknown'));
      const journal = esc(p.journal || p.source);
      const yr = esc(p.year || 'n.d.');
      const src = esc(p.source);
      const cites = p.citations ? ` &middot; <em>${p.citations} citations</em>` : '';
      let doiLink = '';
      if (p.doi) {
        const href = p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`;
        doiLink = ` DOI: <a href="${esc(href)}" target="_blank" rel="noopener" class="doi-link">${esc(p.doi)}</a>`;
      } else if (p.pdf_url) {
        doiLink = ` <a href="${esc(p.pdf_url)}" target="_blank" rel="noopener" class="doi-link">[PDF]</a>`;
      }
      return `
        <div class="reference-item" id="${refId(i)}">
          <span class="ref-num">[${i+1}]</span>
          <span class="ref-body">
            ${authStr}, &ldquo;${esc(p.title)},&rdquo;
            <em>${journal}</em>, ${yr}.
            [${src}]${doiLink}${cites}
          </span>
        </div>`;
    }).join('');
  }

  /* ── Comparison matrix ─────────────────────────────────────────────── */
  function matrixHTML() {
    const rows = papers.slice(0, 30).map(p => ({
      title: p.title,
      authors: Array.isArray(p.authors) ? p.authors.slice(0,2).join(', ') : (p.authors || ''),
      year: p.year, source: p.source, citations: p.citations || 0,
      methodology: p.analysis?.methodology || '—',
      performance: p.analysis?.performance || '—',
      implementation: p.analysis?.implementation || '—',
      complexity: p.analysis?.complexity || '—',
      findings: (p.analysis?.findings || p.abstract || '').substring(0,130) + '…',
      gaps: p.analysis?.gaps || '—',
      repro: p.analysis?.reproducibility || 'not-stated'
    }));
    const reproColor = r => ({
      'open-source':'#2e7d32','data-available':'#1565c0',
      'proprietary':'#b71c1c','not-stated':'#757575'
    })[r] || '#757575';
    return `
      <table class="matrix-table">
        <thead><tr>
          <th style="width:17%">Publication</th>
          <th style="width:5%">Year</th>
          <th style="width:7%">Source</th>
          <th style="width:5%">Cited</th>
          <th style="width:12%">Methodology</th>
          <th style="width:10%">Performance</th>
          <th style="width:10%">Implementation</th>
          <th style="width:7%">Complexity</th>
          <th style="width:15%">Key Findings</th>
          <th style="width:7%">Gaps</th>
          <th style="width:5%">Repro</th>
        </tr></thead>
        <tbody>${rows.map((r,idx) => `
          <tr>
            <td>
              <strong>${esc(r.title)}</strong>
              <br><small style="color:#666">${esc(r.authors)}</small>
            </td>
            <td>${esc(r.year)}</td>
            <td style="font-size:7pt">${esc(r.source)}</td>
            <td style="text-align:center;font-weight:700;color:#0d47a1">${r.citations}</td>
            <td>${esc(r.methodology)}</td>
            <td style="font-weight:600;color:#1a237e">${esc(r.performance)}</td>
            <td>${esc(r.implementation)}</td>
            <td>${esc(r.complexity)}</td>
            <td>${esc(r.findings)}</td>
            <td style="font-size:7.5pt">${esc(r.gaps)}</td>
            <td><span style="font-size:7pt;color:${reproColor(r.repro)};font-weight:600">${esc(r.repro)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /* ── Logo markup ───────────────────────────────────────────────────── */
  function logoImg(src, alt, size = 56) {
    if (src && src.length > 50) {
      return `<img src="${src}" alt="${esc(alt)}" style="width:${size}px;height:${size}px;object-fit:contain;border-radius:4px">`;
    }
    return `<div style="width:${size}px;height:${size}px;background:#0d47a1;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#e8b430;font-size:9pt;font-weight:700;text-align:center;line-height:1.2;padding:4px">${esc(alt)}</div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════
     HTML DOCUMENT
  ══════════════════════════════════════════════════════════════════════ */
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SLR: ${esc(topic)}</title>
<style>
/* ── Base ────────────────────────────────────────────────────────── */
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Times New Roman",Times,serif;color:#111;line-height:1.5;background:#e8eaed;font-size:10pt}
a{color:#0d47a1;text-decoration:none}
a:hover{text-decoration:underline}

/* ── Page shell ──────────────────────────────────────────────────── */
.page{background:#fff;max-width:1020px;margin:0 auto 32px;padding:52px 56px;box-shadow:0 4px 20px rgba(0,0,0,.13);border-radius:3px}
.page-header{border-bottom:2px solid #000;font-size:7pt;text-transform:uppercase;letter-spacing:1.2px;padding-bottom:5px;margin-bottom:26px;color:#444;font-family:Arial;display:flex;justify-content:space-between;align-items:flex-end}
.page-footer{border-top:1px solid #bbb;margin-top:32px;padding-top:8px;font-size:7.5pt;color:#666;font-family:Arial;display:flex;justify-content:space-between;align-items:center}
@media print{body{background:transparent;padding:0}.page{box-shadow:none;margin:0;padding:18mm;page-break-after:always}}

/* ── Cover header ────────────────────────────────────────────────── */
.cover-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:3px solid #0d47a1}
.cover-logo-block{display:flex;align-items:center;gap:10px}
.cover-org-name{font-size:9.5pt;font-weight:700;font-family:Arial;color:#0d1f3d;line-height:1.3}
.cover-org-sub{font-size:8pt;color:#555;font-family:Arial}
.cover-report-no{font-size:8pt;font-family:Arial;color:#777;text-align:right;line-height:1.6}

/* ── Title block ─────────────────────────────────────────────────── */
h1.title{font-size:17pt;text-align:center;margin:0 0 8pt;text-transform:uppercase;letter-spacing:.5px}
.authors-block{text-align:center;font-size:9.5pt;color:#333;margin-bottom:20px;font-family:Arial;line-height:1.9}
.pub-line{font-size:8pt;font-family:Arial;color:#666;text-align:center;margin-bottom:18px}

/* ── Abstract / index terms ──────────────────────────────────────── */
.abstract-box{border:1px solid #b0bec5;background:#f8fafc;padding:14px 18px;border-radius:3px;margin-bottom:20px;font-size:9.5pt}
.abstract-box p{text-indent:0;margin-bottom:4pt}

/* ── Stat cards ──────────────────────────────────────────────────── */
.stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
.stat-box{background:#f0f4f8;border:1px solid #d9e2ec;padding:10px 8px;text-align:center;border-radius:4px}
.stat-number{font-size:16pt;font-weight:700;color:#0d47a1;font-family:Arial}
.stat-label{font-size:6.5pt;text-transform:uppercase;color:#555;font-family:Arial;margin-top:2px}

/* ── TOC ─────────────────────────────────────────────────────────── */
.toc-box{border:1px solid #d0d8e4;padding:14px 18px;margin-bottom:22px;border-radius:3px;font-size:9pt;font-family:Arial}
.toc-title{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;color:#0d47a1}
.toc-row{display:flex;align-items:baseline;gap:4px;line-height:1.9}
.toc-link{color:#0d47a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72%}
.toc-dots{flex:1;border-bottom:1px dotted #aaa;margin-bottom:3px}
.toc-pg{font-size:8pt;color:#666;white-space:nowrap}

/* ── Body text ───────────────────────────────────────────────────── */
.two-col{column-count:2;column-gap:28px;text-align:justify;font-size:9.5pt}
h2{font-size:9.5pt;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:2px;margin:16pt 0 5pt;break-after:avoid;font-family:Arial;letter-spacing:.3px}
p{margin-top:0;margin-bottom:7pt;text-indent:14pt}

/* ── Chapter break ───────────────────────────────────────────────── */
.chapter-break{break-inside:avoid-column}
.chapter-body p{font-size:9.5pt}

/* ── Callout boxes ───────────────────────────────────────────────── */
.box-label{display:block;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4pt;font-family:Arial}
.insight-box{background:#f0f4ff;border-left:3px solid #0d47a1;padding:7pt 10pt;margin:7pt 0;font-size:9pt;break-inside:avoid}
.insight-box .box-label{color:#0d47a1}
.taxonomy-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8pt 0}
.taxonomy-cell{display:flex;gap:10px;background:#f5f7fa;border-left:3px solid #0d47a1;padding:8pt 10pt;border-radius:0 3px 3px 0}
.tax-num{font-size:14pt;font-weight:700;color:#0d47a1;flex-shrink:0;line-height:1;padding-top:2px;font-family:Arial}
.tax-cat{font-size:9pt;font-family:Arial;color:#0d47a1}
.tax-desc{font-size:8.5pt;margin-top:3pt;text-indent:0;color:#333}
.gap-box{background:#fff8f8;border-left:3px solid #c62828;padding:8pt 10pt;margin:7pt 0;font-size:9pt}
.gap-box .box-label{color:#c62828}
.future-box{background:#f4faf4;border-left:3px solid #2e7d32;padding:8pt 10pt;margin:7pt 0;font-size:9pt}
.future-box .box-label{color:#2e7d32}

/* ── Citation superscripts ───────────────────────────────────────── */
sup.cite{font-size:7pt;font-family:Arial;vertical-align:super;line-height:0}
a.cite-link{color:#0d47a1;text-decoration:none;font-weight:600}
a.cite-link:hover{text-decoration:underline}

/* ── References ──────────────────────────────────────────────────── */
.reference-item{font-size:8pt;margin-bottom:5.5pt;display:flex;gap:6pt;break-inside:avoid}
.ref-num{font-weight:700;min-width:28pt;text-align:right;flex-shrink:0;color:#0d47a1}
.ref-body{text-indent:0;line-height:1.5}
a.doi-link{color:#0d47a1;font-size:7.5pt}

/* ── Figures ─────────────────────────────────────────────────────── */
.report-figure{margin:12pt 0;text-align:center;break-inside:avoid;border:1px solid #d9e2ec;padding:8pt;border-radius:3px;background:#fafbfc}
.report-figure img{max-width:100%;max-height:260px;object-fit:contain;display:block;margin:0 auto 8pt}
figcaption{font-size:8.5pt;font-family:Arial;color:#444;text-align:center;line-height:1.5}
.fig-credit{display:block;font-size:7.5pt;color:#888;margin-top:3pt;font-style:italic}
a.fig-src-link{font-size:7.5pt}

/* ── Performance table ───────────────────────────────────────────── */
.perf-table{width:100%;border-collapse:collapse;font-size:8.5pt;font-family:Arial;margin:10px 0 14px}
.perf-table th,.perf-table td{border:1px solid #ccc;padding:5pt 7pt;vertical-align:top}
.perf-table th{background:#0d47a1;color:#fff}
.perf-table tr:nth-child(even){background:#f9fbfd}

/* ── Matrix ──────────────────────────────────────────────────────── */
.matrix-table{width:100%;border-collapse:collapse;font-size:7.5pt;font-family:Arial;margin-top:12px}
.matrix-table th,.matrix-table td{border:1px solid #ccc;padding:5pt 6pt;text-align:left;vertical-align:top}
.matrix-table th{background:#0d47a1;color:#fff;font-size:7pt;text-transform:uppercase}
.matrix-table tr:nth-child(even){background:#f9fbfd}

/* ── Top-cited banner ────────────────────────────────────────────── */
.top-cited-banner{font-size:8.5pt;font-family:Arial;padding:8px 12px;background:#e8f0fe;border-radius:4px;margin-bottom:16px;border-left:3px solid #0d47a1}
</style>
</head>
<body>

<!-- ══════════════ PAGE 1 — COVER & BODY ══════════════════════════ -->
<div class="page">

  <!-- Page header strip -->
  <div class="page-header">
    <span>IEEE Transactions Format &mdash; Systematic Literature Review &amp; Meta-Analysis</span>
    <span>${esc(reportNumber)} &bull; ${dateStr}</span>
  </div>

  <!-- Cover header with logos -->
  <div class="cover-header">
    <div class="cover-logo-block">
      ${logoImg(LOGO1, 'SQI', 56)}
      <div>
        <div class="cover-org-name">SQI College of ICT</div>
        <div class="cover-org-sub">In affiliation with Caleb University</div>
        <div class="cover-org-sub">Imota, Lagos, Nigeria</div>
      </div>
    </div>
    <div style="text-align:center;flex:1;padding:0 20px">
      <div style="font-size:7.5pt;font-family:Arial;color:#0d47a1;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px">Agentic Multi-Database Systematic Survey</div>
      <div style="font-size:7pt;font-family:Arial;color:#777">ArXiv &bull; CrossRef &bull; PubMed &bull; OpenAlex &bull; Semantic Scholar &bull; DBLP</div>
    </div>
    <div class="cover-logo-block" style="flex-direction:row-reverse">
      ${logoImg(LOGO2, 'CU', 56)}
      <div style="text-align:right">
        <div class="cover-org-name">Caleb University</div>
        <div class="cover-org-sub">Faculty of Information Technology</div>
        <div class="cover-org-sub">Imota, Lagos, Nigeria</div>
      </div>
    </div>
  </div>

  <!-- Title -->
  <h1 class="title">${esc(topic)}</h1>
  <div class="authors-block">
    <strong>${esc(reportMeta.authors || 'Agentic Literature Survey System')}</strong><br>
    ${supervisors ? `<span>Supervisors: ${esc(supervisors)}</span><br>` : ''}
    <span>${esc(institution)}</span><br>
    <span style="font-size:8.5pt;color:#555">${dateStr}</span>
  </div>
  <div class="pub-line">Report No. ${esc(reportNumber)} &bull; ${papers.length} Papers Analysed &bull; ${sources.length} Databases &bull; ${minYear}&ndash;${maxYear}</div>

  <!-- Abstract -->
  <div class="abstract-box">
    <p><span style="font-weight:700;font-style:italic">Abstract</span> &mdash; ${esc(review.executive_summary || `Systematic review of ${papers.length} publications on "${topic}".`)}</p>
    <p style="margin-bottom:0"><strong>Index Terms</strong> &mdash; <em>${esc(keywords.length ? keywords.join('; ') : topic)}</em></p>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-box"><div class="stat-number">${papers.length}</div><div class="stat-label">Papers Analyzed</div></div>
    <div class="stat-box"><div class="stat-number">${maxYear-minYear+1}</div><div class="stat-label">Year Span (${minYear}–${maxYear})</div></div>
    <div class="stat-box"><div class="stat-number">${sources.length}</div><div class="stat-label">Databases</div></div>
    <div class="stat-box"><div class="stat-number">${totalCitations.toLocaleString()}</div><div class="stat-label">Total Citations</div></div>
    <div class="stat-box"><div class="stat-number">${Math.round(totalCitations/Math.max(papers.length,1))}</div><div class="stat-label">Avg Citations</div></div>
  </div>

  ${topCited ? `<div class="top-cited-banner">
    <strong>Most Cited:</strong> &ldquo;${esc(topCited.title)}&rdquo; (${esc(topCited.year)}) &mdash; ${topCited.citations.toLocaleString()} citations [${esc(topCited.source)}]
    ${topCited.doi ? ` &mdash; <a href="${topCited.doi.startsWith('http')?topCited.doi:'https://doi.org/'+topCited.doi}" target="_blank" rel="noopener" class="doi-link">DOI</a>` : ''}
  </div>` : ''}

  <!-- Source distribution -->
  <div style="margin-bottom:18px">
    <div style="font-size:8pt;font-family:Arial;font-weight:700;color:#444;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Source Distribution</div>
    ${sourceDistribution()}
  </div>

  <!-- Table of Contents -->
  <div class="toc-box">
    <div class="toc-title">Table of Contents</div>
    ${buildTOC(review.thematic_sections)}
  </div>

  <!-- Body text in two columns -->
  <div class="two-col">

    <!-- Chapter I -->
    <div class="chapter-break" id="i-introduction">
      <h2>I. INTRODUCTION</h2>
      <p>${esc(review.introduction || `The scholarship on &ldquo;${topic}&rdquo; has expanded rapidly, driven by both theoretical advances and growing practical demand. This survey provides a consolidated reference for researchers and practitioners.`)}</p>
    </div>

    <!-- Chapter II -->
    <div class="chapter-break" id="ii-background-theoretical-foundations">
      <h2>II. BACKGROUND &amp; THEORETICAL FOUNDATIONS</h2>
      <p>${esc(review.background || `Foundational contributions to &ldquo;${topic}&rdquo; established the theoretical and empirical foundations that subsequent work builds on.`)}</p>
    </div>

    <!-- Chapters III+ (thematic) -->
    ${sectionsHTML()}

    <!-- Taxonomy -->
    ${taxonomyHTML()}

    <!-- Performance Highlights -->
    ${performanceHighlightsHTML()}

    <!-- Figures / Pictorial Evidence -->
    ${figures.length ? `
      <div class="chapter-break" id="pictorial-evidence">
        <h2>PICTORIAL EVIDENCE &amp; FIGURES</h2>
        ${allFiguresHTML()}
      </div>` : ''}

    <!-- Research Gaps -->
    <div class="chapter-break" id="critical-research-gaps">
      <h2>CRITICAL RESEARCH GAPS</h2>
      <div class="gap-box">
        <span class="box-label">Identified Gaps</span>
        ${(Array.isArray(review.research_gaps) ? review.research_gaps : ['Standardisation and reproducibility remain open.'])
          .map((g,i) => `<p style="text-indent:0;margin-bottom:5pt"><strong>${i+1}.</strong> ${esc(g)}</p>`).join('')}
      </div>
    </div>

    <!-- Future Directions -->
    <div class="chapter-break" id="future-directions">
      <h2>FUTURE DIRECTIONS</h2>
      <div class="future-box">
        <span class="box-label">Recommended Directions</span>
        ${(Array.isArray(review.future_directions) ? review.future_directions : ['Large-scale replication and open benchmarks.'])
          .map((d,i) => `<p style="text-indent:0;margin-bottom:5pt"><strong>&rarr;</strong> ${esc(d)}</p>`).join('')}
      </div>
    </div>

    <!-- Conclusion -->
    <div class="chapter-break" id="conclusion">
      <h2>CONCLUSION</h2>
      <p>${esc(review.conclusion || `This review maps the state of &ldquo;${topic}&rdquo; and charts the most consequential open problems.`)}</p>
    </div>

    <!-- References -->
    <div class="chapter-break" id="references">
      <h2>REFERENCES</h2>
      <div>${referencesHTML()}</div>
    </div>

  </div><!-- /two-col -->

  <div class="page-footer">
    <span>${esc(institution)}</span>
    <span>${esc(reportNumber)}</span>
    <span>${dateStr}</span>
  </div>

</div><!-- /page -->


<!-- ══════════════ PAGE 2 — COMPARISON MATRIX ══════════════════════ -->
<div class="page" style="overflow-x:auto;max-width:1400px">
  <div class="page-header">
    <span>Appendix A &mdash; Systematic Comparison Matrix (${papers.length} Papers)</span>
    <span>${esc(reportNumber)}</span>
  </div>

  <!-- Matrix page logos -->
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
    ${logoImg(LOGO1,'SQI',36)}
    <div style="flex:1;text-align:center">
      <div style="font-size:9pt;font-weight:700;font-family:Arial;color:#0d47a1">Systematic Comparison Matrix</div>
      <div style="font-size:8pt;font-family:Arial;color:#666">${esc(topic)} — Methodology, Performance, Implementation &amp; Reproducibility</div>
    </div>
    ${logoImg(LOGO2,'CU',36)}
  </div>

  <p style="font-size:9pt;font-family:Arial;text-indent:0;color:#555;margin-bottom:12px">
    Full comparative matrix across all reviewed works. Columns show: primary research methodology, headline performance result,
    implementation details, computational complexity, key findings, identified gaps, and reproducibility status.
  </p>
  ${matrixHTML()}

  <div class="page-footer">
    <span>${esc(institution)}</span>
    <span>Appendix A</span>
    <span>${dateStr}</span>
  </div>
</div><!-- /matrix page -->

</body>
</html>`;
}

module.exports = { generateHTMLReport };
