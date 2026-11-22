/**
 * Production REST API & Web Dashboard Server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { refineQuery, analyzeAllPapers, synthesizeReview } = require('./src/agents');
const { performFederatedSearch } = require('./src/search');
const { aggregateAndDeduplicate } = require('./src/dedupe');
const { generateHTMLReport } = require('./src/html_report');
const { createGoogleDoc, isConfigured: googleDocsReady } = require('./src/google_docs');

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    if (key && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/(^["']|["']$)/g, '');
    }
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);

async function executeSurvey(topic) {
  const refined = await refineQuery(topic, process.env);
  const searchResults = await performFederatedSearch({ topic, refinedQueries: refined.refined_queries });
  const deduplicatedPapers = aggregateAndDeduplicate(searchResults);
  const papersToAnalyze = deduplicatedPapers.slice(0, 25);
  const analyses = await analyzeAllPapers(papersToAnalyze, process.env, 5);
  papersToAnalyze.forEach((p, i) => { p.analysis = analyses[i]; });
  const review = await synthesizeReview(
    { topic, papers: papersToAnalyze, keywords: refined.keywords, domain: refined.domain || '' },
    process.env
  );
  const htmlContent = generateHTMLReport({ topic, review, papers: papersToAnalyze, keywords: refined.keywords });
  return { topic, review, papers: papersToAnalyze, htmlContent };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url.pathname === '/api/health' || url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime(), google_docs: googleDocsReady() }));
    return;
  }

  if (url.pathname === '/api/survey' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { topic, email, save_to_google_docs } = payload;
        if (!topic) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: "topic"' }));
          return;
        }
        console.log(`[API] Survey request: "${topic}"${email ? ` → ${email}` : ''}`);
        const result = await executeSurvey(topic);
        let google_doc_url = null;
        if (save_to_google_docs && googleDocsReady()) {
          try {
            const { docUrl } = await createGoogleDoc({ title: `Literature Survey: ${topic}`, htmlContent: result.htmlContent, shareWithEmail: email || null });
            google_doc_url = docUrl;
            console.log(`[Google Docs] Created: ${docUrl}`);
          } catch (err) { console.error('[Google Docs Error]:', err.message); }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, topic: result.topic, papers_count: result.papers.length, html_report: result.htmlContent, matrix: result.papers, review: result.review, google_doc_url }));
      } catch (err) {
        console.error('[API Error]:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (url.pathname === '/' && req.method === 'GET') {
    const ge = googleDocsReady();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>Literature Survey · SQI College of ICT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Layout: single centered column 760px, sticky navy header, parchment ground */
:root {
  --bg: #f2f0eb;
  --surface: #ffffff;
  --surface-2: #f7f5f0;
  --border: #ddd9d0;
  --border-strong: #c8c2b4;
  --navy: #0d1f3d;
  --navy-2: #1a3360;
  --gold: #b8800a;
  --gold-2: #d4960c;
  --accent: #1a4a90;
  --accent-2: #2358a8;
  --text: #0d1f3d;
  --text-2: #3a4e6e;
  --text-3: #7a8898;
  --success: #0e6e44;
  --danger: #c42828;
  --shadow-sm: 0 1px 3px rgba(13,31,61,.07),0 2px 8px rgba(13,31,61,.05);
  --shadow: 0 1px 4px rgba(13,31,61,.08),0 4px 20px rgba(13,31,61,.07);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #07101e;
    --surface: #0c1828;
    --surface-2: #102030;
    --border: #1c2e48;
    --border-strong: #243a58;
    --navy: #d0dff0;
    --navy-2: #a8bcd8;
    --gold: #e0a820;
    --gold-2: #f0c030;
    --accent: #4a7cd8;
    --accent-2: #5a8ce8;
    --text: #dce8f8;
    --text-2: #90a8c8;
    --text-3: #4e6080;
    --success: #28c880;
    --danger: #e06060;
    --shadow-sm: 0 1px 3px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.2);
    --shadow: 0 1px 4px rgba(0,0,0,.35),0 4px 20px rgba(0,0,0,.25);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #07101e; --surface: #0c1828; --surface-2: #102030;
  --border: #1c2e48; --border-strong: #243a58;
  --navy: #d0dff0; --navy-2: #a8bcd8;
  --gold: #e0a820; --gold-2: #f0c030;
  --accent: #4a7cd8; --accent-2: #5a8ce8;
  --text: #dce8f8; --text-2: #90a8c8; --text-3: #4e6080;
  --success: #28c880; --danger: #e06060;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.2);
  --shadow: 0 1px 4px rgba(0,0,0,.35),0 4px 20px rgba(0,0,0,.25);
  color-scheme: dark;
}
*{box-sizing:border-box;margin:0;padding:0;}
body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  padding-left: max(16px, env(safe-area-inset-left,0px));
  padding-right: max(16px, env(safe-area-inset-right,0px));
  padding-block: 0;
  font-size: 15px;
  line-height: 1.5;
}

/* ── Top bar ── */
.topbar {
  position: sticky;
  top: env(safe-area-inset-top,0px);
  z-index: 100;
  background: #0d1f3d;
  border-bottom: 2px solid var(--gold);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 24px;
  margin-left: calc(-1 * max(16px, env(safe-area-inset-left,0px)));
  margin-right: calc(-1 * max(16px, env(safe-area-inset-right,0px)));
  padding-left: max(24px, env(safe-area-inset-left,0px));
  padding-right: max(24px, env(safe-area-inset-right,0px));
}
.brand { display:flex; align-items:center; gap:12px; }
.brand-seal {
  width:38px; height:38px;
  border: 2px solid var(--gold);
  border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-family:'Playfair Display',Georgia,serif;
  font-weight:800; font-size:13px; letter-spacing:-0.5px;
  color: var(--gold);
  background: rgba(184,128,10,.12);
  flex-shrink:0;
}
.brand-name {
  font-size:11px; font-weight:700;
  letter-spacing:1.8px; text-transform:uppercase;
  color: var(--gold);
  line-height:1.2;
}
.brand-sub { font-size:10px; color:rgba(200,220,248,.55); line-height:1.4; }
.nav-tag {
  font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase;
  color:rgba(200,220,248,.4);
  border:1px solid rgba(200,220,248,.12);
  border-radius:999px; padding:3px 10px;
}
@media(max-width:480px){.nav-tag{display:none;}}

/* ── Page wrapper ── */
.wrap { max-width:760px; margin:0 auto; padding-block:0 64px; }

/* ── Hero ── */
.hero {
  text-align:center;
  padding:60px 0 40px;
}
.hero-eye {
  font-size:11px; font-weight:600;
  letter-spacing:2.5px; text-transform:uppercase;
  color: var(--gold); margin-bottom:14px;
}
.hero-title {
  font-family:'Playfair Display',Georgia,serif;
  font-size:clamp(28px,6vw,48px);
  font-weight:800; line-height:1.07;
  color: var(--text);
  text-wrap:balance; margin-bottom:16px;
}
.hero-title em { font-style:italic; color:var(--accent); }
.hero-desc {
  font-size:15px; color:var(--text-2);
  line-height:1.65; max-width:510px;
  margin:0 auto 28px;
}
.db-strip { display:flex; flex-wrap:wrap; justify-content:center; gap:6px; }
.db-pill {
  font-size:11px; font-weight:500;
  padding:4px 10px; border-radius:999px;
  border:1px solid var(--border-strong);
  color:var(--text-3); background:var(--surface);
}

/* ── Card ── */
.card {
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:16px; padding:32px;
  box-shadow:var(--shadow); margin-bottom:16px;
}
.field { margin-bottom:20px; }
.label {
  display:block; font-size:11.5px; font-weight:600;
  letter-spacing:.5px; text-transform:uppercase;
  color:var(--text-2); margin-bottom:8px;
}
.input {
  width:100%; padding:13px 16px;
  background:var(--surface-2);
  border:1.5px solid var(--border);
  border-radius:10px; color:var(--text);
  font-size:15px; font-family:inherit; outline:none;
  transition:border-color .15s, box-shadow .15s;
  min-width:0;
}
.input:focus {
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(26,74,144,.1);
}
.input::placeholder { color:var(--text-3); }

.row2 { display:flex; gap:12px; align-items:flex-start; }
.row2 .field { flex:1; min-width:0; margin-bottom:0; }
.gdocs-wrap { flex-shrink:0; padding-top:28px; }
.gdocs-toggle {
  display:flex; align-items:center; gap:8px;
  padding:12px 14px;
  background:var(--surface-2);
  border:1.5px solid var(--border); border-radius:10px;
  cursor:pointer; user-select:none;
  transition:border-color .15s; white-space:nowrap;
}
.gdocs-toggle:hover:not(.disabled) { border-color:var(--border-strong); }
.gdocs-toggle.disabled { opacity:.5; cursor:default; }
.gdocs-toggle input[type=checkbox] { display:none; }
.track {
  position:relative; width:32px; height:18px;
  background:var(--border-strong); border-radius:9px;
  transition:background .2s; flex-shrink:0; pointer-events:none;
}
.track::after {
  content:''; position:absolute;
  width:12px; height:12px; border-radius:50%;
  background:white; top:3px; left:3px;
  transition:transform .2s;
  box-shadow:0 1px 2px rgba(0,0,0,.2);
}
input[type=checkbox]:checked ~ .track { background:var(--accent); }
input[type=checkbox]:checked ~ .track::after { transform:translateX(14px); }
.gdocs-lbl { font-size:12px; font-weight:500; color:var(--text-2); }
.gbadge {
  font-size:10px; font-weight:700;
  padding:2px 6px; border-radius:4px;
}
.gbadge.on { background:rgba(14,110,68,.1); color:var(--success); }
.gbadge.off { background:var(--surface); color:var(--text-3); border:1px solid var(--border); }

.btn-run {
  width:100%; padding:15px 20px;
  background:var(--navy);
  color:#fff; border:none; border-radius:10px;
  font-size:15px; font-weight:600; font-family:inherit;
  cursor:pointer; transition:background .15s, transform .08s;
  display:flex; align-items:center; justify-content:center; gap:8px;
  margin-top:4px; overflow:hidden; position:relative;
}
.btn-run::after {
  content:''; position:absolute;
  inset:0; background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);
  transform:translateX(-100%); transition:transform .5s;
}
.btn-run:hover:not(:disabled)::after { transform:translateX(100%); }
.btn-run:hover:not(:disabled) { background:var(--navy-2); }
.btn-run:active:not(:disabled) { transform:scale(.99); }
.btn-run:disabled { opacity:.5; cursor:not-allowed; }

hr.div { border:none; border-top:1px solid var(--border); margin:24px 0; }
.ex-lbl {
  font-size:11px; font-weight:600; letter-spacing:1px;
  text-transform:uppercase; color:var(--text-3); margin-bottom:10px;
}
.chips { display:flex; flex-wrap:wrap; gap:7px; }
.chip {
  font-size:12px; padding:6px 12px;
  border:1px solid var(--border); border-radius:999px;
  color:var(--text-2); background:transparent;
  cursor:pointer; font-family:inherit; transition:all .15s;
}
.chip:hover { border-color:var(--accent); color:var(--accent); background:rgba(26,74,144,.06); }

/* ── Pipeline ── */
.pipeline { display:none; }
.pipeline.on { display:block; }
.pip-title {
  font-size:11px; font-weight:600; letter-spacing:1px;
  text-transform:uppercase; color:var(--text-3);
  margin-bottom:22px; text-align:center;
}
.stages {
  display:flex; align-items:flex-start;
  position:relative; margin-bottom:14px;
}
.stage-rail {
  position:absolute; top:17px;
  left:calc(10% + 18px); right:calc(10% + 18px);
  height:2px; background:var(--border); z-index:0;
}
.stage-prog {
  height:100%; background:var(--accent);
  transition:width .6s cubic-bezier(.4,0,.2,1); width:0;
}
.stage {
  flex:1; display:flex; flex-direction:column;
  align-items:center; gap:7px; position:relative; z-index:1;
}
.sdot {
  width:36px; height:36px; border-radius:50%;
  border:2px solid var(--border); background:var(--surface);
  display:flex; align-items:center; justify-content:center;
  font-size:14px; transition:all .3s;
}
.stage.cur .sdot {
  border-color:var(--accent); background:rgba(26,74,144,.08);
  animation:spulse 1.8s ease-in-out infinite;
}
.stage.done .sdot {
  border-color:var(--success); background:rgba(14,110,68,.08);
}
@keyframes spulse {
  0%,100%{box-shadow:0 0 0 0 rgba(26,74,144,.3);}
  50%{box-shadow:0 0 0 8px rgba(26,74,144,0);}
}
.sname {
  font-size:10px; font-weight:500;
  color:var(--text-3); text-align:center; line-height:1.3;
}
.stage.cur .sname { color:var(--accent); font-weight:600; }
.stage.done .sname { color:var(--success); }
.pip-msg {
  text-align:center; font-size:13px; color:var(--text-2);
  font-style:italic; min-height:36px; padding:8px;
}

/* ── Notifications ── */
.notif {
  display:none; padding:14px 16px; border-radius:10px;
  font-size:13px; margin-bottom:12px; line-height:1.5;
}
.notif.err { background:rgba(196,40,40,.06); border:1px solid rgba(196,40,40,.25); color:var(--danger); }
.notif.ok  { background:rgba(14,110,68,.06); border:1px solid rgba(14,110,68,.22); color:var(--success); }
.notif.vis { display:block; }
.notif a { color:inherit; font-weight:600; text-decoration:none; }
.notif a:hover { text-decoration:underline; }

/* ── Results ── */
.results { display:none; }
.results.vis { display:block; }
.res-hdr {
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:10px; flex-wrap:wrap; margin-bottom:18px;
}
.res-title {
  font-family:'Playfair Display',Georgia,serif;
  font-size:21px; font-weight:700; color:var(--text);
  line-height:1.25; min-width:0; text-wrap:balance;
}
.res-actions { display:flex; gap:8px; flex-shrink:0; }
.btn-sm {
  padding:8px 14px; border:1px solid var(--border);
  border-radius:8px; font-size:12px; font-weight:600;
  font-family:inherit; color:var(--text-2); background:var(--surface);
  cursor:pointer; transition:all .15s;
  display:flex; align-items:center; gap:5px; text-decoration:none;
}
.btn-sm:hover { border-color:var(--accent); color:var(--accent); }
.btn-sm.pri { background:var(--accent); border-color:var(--accent); color:#fff; }
.btn-sm.pri:hover { background:var(--accent-2); border-color:var(--accent-2); color:#fff; }

.stats-row {
  display:grid; grid-template-columns:repeat(4,1fr);
  gap:10px; margin-bottom:18px;
}
.scard {
  background:var(--surface); border:1px solid var(--border);
  border-radius:10px; padding:14px 10px;
  text-align:center; box-shadow:var(--shadow-sm);
}
.snum {
  font-family:'Playfair Display',Georgia,serif;
  font-size:28px; font-weight:800; color:var(--gold);
  line-height:1; font-variant-numeric:tabular-nums;
}
.slbl {
  font-size:10px; font-weight:600; letter-spacing:.8px;
  text-transform:uppercase; color:var(--text-3); margin-top:5px;
}

.summary-block {
  background:var(--surface); border:1px solid var(--border);
  border-left:3px solid var(--accent); border-radius:10px;
  padding:18px 20px; margin-bottom:16px; box-shadow:var(--shadow-sm);
}
.block-lbl {
  font-size:10px; font-weight:700; letter-spacing:1.5px;
  text-transform:uppercase; margin-bottom:9px;
}
.summary-block .block-lbl { color:var(--accent); }
.summary-txt { font-size:14px; color:var(--text-2); line-height:1.65; }

.sections-lbl {
  font-size:10px; font-weight:700; letter-spacing:1.5px;
  text-transform:uppercase; color:var(--text-3); margin-bottom:10px;
}
.sec-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.sec-item {
  display:flex; align-items:center; gap:12px;
  padding:11px 16px; background:var(--surface);
  border:1px solid var(--border); border-radius:8px;
  box-shadow:var(--shadow-sm);
}
.sec-n {
  width:22px; height:22px; border-radius:50%;
  background:rgba(26,74,144,.1); border:1px solid rgba(26,74,144,.3);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:700; color:var(--accent); flex-shrink:0;
  font-variant-numeric:tabular-nums;
}
.sec-title {
  font-size:13px; font-weight:500; color:var(--text);
  min-width:0; line-height:1.35;
}

.gaps-block {
  background:var(--surface); border:1px solid var(--border);
  border-left:3px solid var(--gold); border-radius:10px;
  padding:16px 20px; margin-bottom:20px; box-shadow:var(--shadow-sm);
}
.gaps-block .block-lbl { color:var(--gold); }
.gap-row {
  display:flex; gap:10px; font-size:13px; color:var(--text-2);
  line-height:1.5; margin-bottom:7px;
}
.gap-row:last-child { margin-bottom:0; }
.gdot {
  width:6px; height:6px; border-radius:50%;
  background:var(--gold); flex-shrink:0; margin-top:6px;
}

.report-wrap { display:none; margin-top:12px; }
.report-wrap.vis { display:block; }
.report-wrap iframe {
  width:100%; height:700px;
  border:1px solid var(--border); border-radius:12px; background:#fff;
}

/* ── Footer ── */
.footer {
  border-top:1px solid var(--border);
  margin:0 calc(-1 * max(16px, env(safe-area-inset-left,0px)));
  padding:28px max(24px, env(safe-area-inset-left,0px));
  text-align:center; font-size:11px; color:var(--text-3); line-height:1.9;
}
.footer strong { color:var(--text-2); font-weight:600; }
.f-seal {
  display:inline-flex; align-items:center; gap:7px;
  font-size:12px; font-weight:600; color:var(--text-2);
  margin-bottom:6px;
}
.f-seal-icon {
  width:26px; height:26px; border-radius:50%;
  border:1.5px solid var(--gold); display:flex; align-items:center;
  justify-content:center; font-family:'Playfair Display',Georgia,serif;
  font-weight:800; font-size:9px; color:var(--gold);
  background:rgba(184,128,10,.08);
}

@media(max-width:600px) {
  .card { padding:20px; }
  .stats-row { grid-template-columns:repeat(2,1fr); }
  .row2 { flex-direction:column; }
  .gdocs-wrap { padding-top:0; }
  .hero { padding:40px 0 28px; }
  .sname { display:none; }
  .res-actions { gap:6px; }
}
</style>
</head>
<body>

<div class="topbar">
  <div class="brand">
    <div class="brand-seal">SQI</div>
    <div>
      <div class="brand-name">SQI College of ICT</div>
      <div class="brand-sub">Caleb University &bull; Imota, Lagos</div>
    </div>
  </div>
  <span class="nav-tag">Research Suite</span>
</div>

<div class="wrap">

  <div class="hero">
    <div class="hero-eye">Agentic Multi-Database Retrieval</div>
    <h1 class="hero-title">Systematic Literature<br><em>Survey Generator</em></h1>
    <p class="hero-desc">Enter any research topic. Six academic databases are searched in parallel, every paper is analyzed with AI, and an IEEE-style review is synthesized — in under two minutes.</p>
    <div class="db-strip">
      <span class="db-pill">ArXiv</span>
      <span class="db-pill">CrossRef</span>
      <span class="db-pill">PubMed</span>
      <span class="db-pill">OpenAlex</span>
      <span class="db-pill">Semantic Scholar</span>
      <span class="db-pill">DBLP</span>
    </div>
  </div>

  <div class="card" id="formCard">
    <div class="field">
      <label class="label" for="topicInput">Research Topic</label>
      <input class="input" type="text" id="topicInput"
        placeholder="e.g. RISC-V out-of-order execution and branch prediction"
        autocomplete="off">
    </div>

    <div class="row2">
      <div class="field">
        <label class="label" for="emailInput">
          Email <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-3)">— optional</span>
        </label>
        <input class="input" type="email" id="emailInput" placeholder="you@example.com">
      </div>
      <div class="gdocs-wrap">
        ${ge ? `
        <label class="gdocs-toggle" for="gdocsCheck">
          <input type="checkbox" id="gdocsCheck">
          <div class="track"></div>
          <span class="gdocs-lbl">Google&nbsp;Docs</span>
          <span class="gbadge on">Connected</span>
        </label>` : `
        <label class="gdocs-toggle disabled">
          <input type="checkbox" id="gdocsCheck" disabled>
          <div class="track"></div>
          <span class="gdocs-lbl">Google&nbsp;Docs</span>
          <span class="gbadge off">Not set up</span>
        </label>`}
      </div>
    </div>

    <button class="btn-run" id="runBtn" onclick="runSurvey()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      Generate Literature Survey
    </button>

    <hr class="div">
    <div class="ex-lbl">Example topics</div>
    <div class="chips">
      <button class="chip" onclick="useTopic(this)">Cache coherence in multi-core processors</button>
      <button class="chip" onclick="useTopic(this)">Sepsis prediction using ML in ICU patients</button>
      <button class="chip" onclick="useTopic(this)">Transformer attention mechanisms in LLMs</button>
      <button class="chip" onclick="useTopic(this)">Reinforcement learning reward shaping</button>
      <button class="chip" onclick="useTopic(this)">Quantum error correction codes</button>
      <button class="chip" onclick="useTopic(this)">mRNA vaccine immunogenicity</button>
      <button class="chip" onclick="useTopic(this)">Constitutional law and judicial review</button>
    </div>
  </div>

  <!-- Pipeline -->
  <div class="card pipeline" id="pipeline">
    <div class="pip-title">Pipeline Progress</div>
    <div class="stages">
      <div class="stage-rail"><div class="stage-prog" id="stageProg"></div></div>
      <div class="stage" id="s0"><div class="sdot">&#x1F50D;</div><span class="sname">Refining<br>Query</span></div>
      <div class="stage" id="s1"><div class="sdot">&#x1F5C4;&#xFE0F;</div><span class="sname">Searching<br>Databases</span></div>
      <div class="stage" id="s2"><div class="sdot">&#x1F4C4;</div><span class="sname">Analyzing<br>Papers</span></div>
      <div class="stage" id="s3"><div class="sdot">&#x2697;&#xFE0F;</div><span class="sname">Synthesizing<br>Review</span></div>
      <div class="stage" id="s4"><div class="sdot">&#x2705;</div><span class="sname">Complete</span></div>
    </div>
    <div class="pip-msg" id="pipMsg">Starting agentic workflow&hellip;</div>
  </div>

  <!-- Notifications -->
  <div class="notif err" id="errBox"></div>
  <div class="notif ok"  id="docBox"></div>

  <!-- Results -->
  <div class="results" id="results">
    <div class="res-hdr">
      <h2 class="res-title" id="resTitle">Survey Complete</h2>
      <div class="res-actions">
        <button class="btn-sm" onclick="dlReport()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button class="btn-sm pri" onclick="toggleReport()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span id="rptLbl">View Full Report</span>
        </button>
      </div>
    </div>

    <div class="stats-row">
      <div class="scard"><div class="snum" id="stPapers">—</div><div class="slbl">Papers</div></div>
      <div class="scard"><div class="snum" id="stSrc">—</div><div class="slbl">Databases</div></div>
      <div class="scard"><div class="snum" id="stCite">—</div><div class="slbl">Total Citations</div></div>
      <div class="scard"><div class="snum" id="stPerf">—</div><div class="slbl">Perf Highlights</div></div>
    </div>

    <div class="summary-block">
      <div class="block-lbl">Executive Summary</div>
      <div class="summary-txt" id="summaryTxt"></div>
    </div>

    <div class="sections-lbl">Thematic Sections</div>
    <div class="sec-list" id="secList"></div>

    <div class="gaps-block">
      <div class="block-lbl">Research Gaps Identified</div>
      <div id="gapsList"></div>
    </div>

    <div class="report-wrap" id="rptWrap">
      <iframe id="rptFrame" title="Full IEEE Literature Review"></iframe>
    </div>
  </div>

</div>

<div class="footer">
  <div class="f-seal">
    <div class="f-seal-icon">SQI</div>
    SQI College of Information &amp; Communication Technology
  </div><br>
  <strong>Caleb University</strong> &bull; Imota, Lagos, Nigeria<br>
  Sources: ArXiv &bull; CrossRef &bull; PubMed &bull; OpenAlex &bull; Semantic Scholar &bull; DBLP<br>
  AI Engine: Groq &bull; OpenRouter &bull; Open-source, free to use &amp; contribute
</div>

<script>
(function(){
  var _html = '', _rptOn = false;

  function esc(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  window.useTopic = function(btn){
    document.getElementById('topicInput').value = btn.textContent.trim();
    document.getElementById('topicInput').focus();
  };

  function setStage(n){
    for(var i=0;i<5;i++){
      var el=document.getElementById('s'+i);
      el.classList.remove('cur','done');
      if(i<n) el.classList.add('done');
      else if(i===n) el.classList.add('cur');
    }
    document.getElementById('stageProg').style.width=(n/4*100)+'%';
  }

  var msgs=[
    'Analyzing topic and generating precise search queries…',
    'Querying ArXiv, CrossRef, PubMed, OpenAlex, Semantic Scholar, DBLP…',
    'AI analyzing each paper in parallel batches of 5…',
    'Synthesizing findings into IEEE-style literature review…',
    'Survey complete.'
  ];

  function countUp(el,target,ms){
    var start=performance.now();
    function tick(){
      var t=Math.min((performance.now()-start)/ms,1);
      var v=Math.round(t*t*target);
      el.textContent=v.toLocaleString();
      if(t<1) requestAnimationFrame(tick);
      else el.textContent=target.toLocaleString();
    }
    requestAnimationFrame(tick);
  }

  window.runSurvey = async function(){
    var topic=document.getElementById('topicInput').value.trim();
    if(!topic){document.getElementById('topicInput').focus();return;}
    var email=document.getElementById('emailInput').value.trim();
    var gdocs=document.getElementById('gdocsCheck').checked||false;

    document.getElementById('runBtn').disabled=true;
    document.getElementById('errBox').classList.remove('vis');
    document.getElementById('docBox').classList.remove('vis');
    document.getElementById('results').classList.remove('vis');
    document.getElementById('pipeline').classList.add('on');
    _rptOn=false;
    document.getElementById('rptWrap').classList.remove('vis');
    document.getElementById('rptLbl').textContent='View Full Report';

    setStage(0);
    document.getElementById('pipMsg').textContent=msgs[0];

    var t1=setTimeout(function(){setStage(1);document.getElementById('pipMsg').textContent=msgs[1];},2500);
    var t2=setTimeout(function(){setStage(2);document.getElementById('pipMsg').textContent=msgs[2];},6000);
    var t3=setTimeout(function(){setStage(3);document.getElementById('pipMsg').textContent=msgs[3];},20000);

    try{
      var res=await fetch('/api/survey',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({topic:topic,email:email||undefined,save_to_google_docs:gdocs})
      });
      clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);
      var data=await res.json();
      if(!res.ok) throw new Error(data.error||'Server error');

      _html=data.html_report||'';
      var review=data.review||{};
      var papers=data.matrix||[];
      var sources=[...new Set(papers.map(function(p){return p.source;}))].length;
      var cites=papers.reduce(function(s,p){return s+(p.citations||0);},0);
      var perf=(review.performance_highlights||[]).length;

      setStage(4);
      document.getElementById('pipMsg').textContent=msgs[4];

      countUp(document.getElementById('stPapers'),data.papers_count||0,800);
      countUp(document.getElementById('stSrc'),sources||6,500);
      countUp(document.getElementById('stCite'),cites,900);
      countUp(document.getElementById('stPerf'),perf,500);

      var t=topic.length>55?topic.substring(0,55)+'…':topic;
      document.getElementById('resTitle').textContent='Survey: '+t;
      document.getElementById('summaryTxt').textContent=review.executive_summary||'';

      var sl=document.getElementById('secList');
      sl.innerHTML='';
      (review.thematic_sections||[]).forEach(function(s,i){
        var d=document.createElement('div');
        d.className='sec-item';
        d.innerHTML='<span class="sec-n">'+(i+1)+'</span><span class="sec-title">'+esc(s.title||'')+'</span>';
        sl.appendChild(d);
      });

      var gl=document.getElementById('gapsList');
      gl.innerHTML=(review.research_gaps||[]).slice(0,4).map(function(g){
        return '<div class="gap-row"><div class="gdot"></div><span>'+esc(g)+'</span></div>';
      }).join('');

      if(data.google_doc_url){
        var db=document.getElementById('docBox');
        db.innerHTML='&#x1F4C4; Saved to Google Docs &mdash; <a href="'+data.google_doc_url+'" target="_blank" rel="noopener">Open document &rarr;</a>';
        db.classList.add('vis');
      }

      document.getElementById('results').classList.add('vis');
      document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});

    }catch(err){
      clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);
      setStage(0);
      document.getElementById('pipeline').classList.remove('on');
      var eb=document.getElementById('errBox');
      eb.textContent='Error: '+err.message;
      eb.classList.add('vis');
    }finally{
      document.getElementById('runBtn').disabled=false;
    }
  };

  window.toggleReport = function(){
    _rptOn=!_rptOn;
    var wrap=document.getElementById('rptWrap');
    var lbl=document.getElementById('rptLbl');
    if(_rptOn){
      document.getElementById('rptFrame').srcdoc=_html;
      wrap.classList.add('vis');
      lbl.textContent='Close Report';
      wrap.scrollIntoView({behavior:'smooth',block:'start'});
    }else{
      wrap.classList.remove('vis');
      lbl.textContent='View Full Report';
    }
  };

  window.dlReport = function(){
    if(!_html) return;
    var blob=new Blob([_html],{type:'text/html'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download='literature-survey.html';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  document.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target.id==='topicInput') runSurvey();
  });
})();
</script>
</body>
</html>`);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Google Docs] ${googleDocsReady() ? 'Configured ✓' : 'Not configured (set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY)'}`);
});
