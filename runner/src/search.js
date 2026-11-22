/**
 * Academic Database Retrieval Engine
 * Sources: ArXiv · CrossRef · PubMed · OpenAlex · Semantic Scholar · DBLP
 */

const CURRENT_YEAR = new Date().getFullYear();
const FROM_YEAR = CURRENT_YEAR - 7;

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function searchArXiv(query, maxResults = 20) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `http://export.arxiv.org/api/query?search_query=all:${encoded}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LiteratureSurveyAgent/2.0' } });
    if (!res.ok) return [];
    const xml = await res.text();
    return xml.split('<entry>').slice(1).map(entry => {
      const get = (tag) => entry.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.replace(/\s+/g, ' ').trim() || '';
      const authorsMatches = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)];
      const doiMatch = entry.match(/arxiv\.org\/abs\/(.*?)(?:<|"| )/);
      const catMatch = entry.match(/<category term="([^"]+)"/);
      return {
        title: get('title'),
        authors: authorsMatches.map(m => m[1].trim()),
        year: get('published').match(/(\d{4})/)?.[1] || 'N/A',
        abstract: get('summary'),
        doi: doiMatch ? `10.48550/arXiv.${doiMatch[1]}` : '',
        journal: 'arXiv Preprint',
        source: 'ArXiv',
        citations: 0,
        category: catMatch?.[1] || '',
        pdf_url: doiMatch ? `https://arxiv.org/pdf/${doiMatch[1]}.pdf` : ''
      };
    }).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[ArXiv] ${err.message}`);
    return [];
  }
}

async function searchCrossRef(query, rows = 20) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encoded}&rows=${rows}&filter=from-pub-date:${FROM_YEAR}&sort=relevance&mailto=research@survey.com`;
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': 'LiteratureSurveyWorkflow/2.0 (mailto:research@survey.com)' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message?.items || []).map(item => ({
      title: item.title?.[0] || '',
      authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
      year: item['published-print']?.['date-parts']?.[0]?.[0]
         || item['published-online']?.['date-parts']?.[0]?.[0] || 'N/A',
      journal: item['container-title']?.[0] || 'CrossRef Journal',
      doi: item.DOI || '',
      abstract: item.abstract?.replace(/<[^>]+>/g, '') || '',
      source: 'CrossRef',
      citations: item['is-referenced-by-count'] || 0,
      type: item.type || 'journal-article'
    })).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[CrossRef] ${err.message}`);
    return [];
  }
}

async function searchPubMed(query, retmax = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=${retmax}&retmode=json&sort=relevance&datetype=pdat&mindate=${FROM_YEAR}&maxdate=${CURRENT_YEAR}`;
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) return [];
    const searchData = await res.json();
    const idList = searchData.esearchresult?.idlist || [];
    if (!idList.length) return [];
    const sumRes = await fetchWithTimeout(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`
    );
    if (!sumRes.ok) return [];
    const sumData = await sumRes.json();
    const result = sumData.result || {};
    return idList.map(pmid => {
      const doc = result[pmid] || {};
      return {
        pmid,
        title: doc.title?.replace(/\.$/, '') || '',
        authors: (doc.authors || []).map(a => a.name).join(', ') || 'Unknown Authors',
        year: (doc.pubdate || '').match(/\d{4}/)?.[0] || 'N/A',
        journal: doc.source || 'PubMed Journal',
        doi: (doc.articleids || []).find(id => id.idtype === 'doi')?.value || '',
        abstract: `PubMed indexed abstract (PMID: ${pmid})`,
        source: 'PubMed',
        citations: 0
      };
    }).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[PubMed] ${err.message}`);
    return [];
  }
}

async function searchOpenAlex(query, perPage = 20) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.openalex.org/works?search=${encoded}&filter=publication_year:${FROM_YEAR}-${CURRENT_YEAR}&sort=cited_by_count:desc&per-page=${perPage}&select=id,title,authorships,publication_year,abstract_inverted_index,cited_by_count,doi,primary_location,concepts,type`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'mailto:research@survey.com' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(work => {
      let abstract = '';
      if (work.abstract_inverted_index) {
        const pos = {};
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          positions.forEach(p => { pos[p] = word; });
        }
        abstract = Object.keys(pos).sort((a, b) => a - b).map(p => pos[p]).join(' ');
      }
      return {
        title: work.title || '',
        authors: (work.authorships || []).slice(0, 6).map(a => a.author?.display_name || '').join(', '),
        year: work.publication_year || 'N/A',
        journal: work.primary_location?.source?.display_name || 'OpenAlex',
        doi: work.doi?.replace('https://doi.org/', '') || '',
        abstract,
        source: 'OpenAlex',
        citations: work.cited_by_count || 0,
        fields: (work.concepts || []).slice(0, 4).map(c => c.display_name).join(', ')
      };
    }).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[OpenAlex] ${err.message}`);
    return [];
  }
}

async function searchSemanticScholar(query, limit = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=${limit}&fields=title,authors,year,abstract,citationCount,externalIds,venue,fieldsOfStudy&year=${FROM_YEAR}-`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LiteratureSurveyAgent/2.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(paper => ({
      title: paper.title || '',
      authors: (paper.authors || []).slice(0, 6).map(a => a.name).join(', '),
      year: paper.year || 'N/A',
      journal: paper.venue || 'Semantic Scholar',
      doi: paper.externalIds?.DOI || '',
      abstract: paper.abstract || '',
      source: 'Semantic Scholar',
      citations: paper.citationCount || 0,
      fields: (paper.fieldsOfStudy || []).join(', ')
    })).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[Semantic Scholar] ${err.message}`);
    return [];
  }
}

async function searchDblp(query, hits = 15) {
  try {
    const encoded = encodeURIComponent(query);
    const url = `https://dblp.org/search/publ/api?q=${encoded}&format=json&h=${hits}&f=0`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'LiteratureSurveyAgent/2.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const hits_data = data.result?.hits?.hit || [];
    return hits_data.map(hit => {
      const info = hit.info || {};
      const authors = info.authors?.author;
      const authorList = Array.isArray(authors)
        ? authors.slice(0, 6).map(a => typeof a === 'string' ? a : a.text || '').join(', ')
        : typeof authors === 'string' ? authors : '';
      return {
        title: info.title?.replace(/\.$/, '') || '',
        authors: authorList || 'Unknown Authors',
        year: info.year || 'N/A',
        journal: info.venue || info.booktitle || info.journal || 'DBLP',
        doi: info.doi || '',
        abstract: '',
        source: 'DBLP',
        citations: 0,
        url: info.url || ''
      };
    }).filter(p => p.title.length > 0);
  } catch (err) {
    console.warn(`[DBLP] ${err.message}`);
    return [];
  }
}

/**
 * Federated parallel search across all 6 databases.
 */
async function performFederatedSearch({ topic, refinedQueries = [] }) {
  console.log(`[Search] Parallel retrieval across 6 databases...`);

  const q0 = refinedQueries[0] || topic;
  const q1 = refinedQueries[1] || `${topic} systematic review`;
  const q2 = refinedQueries[2] || `${topic} methodology`;
  const q3 = refinedQueries[3] || topic;
  const q4 = refinedQueries[4] || `${topic} empirical evaluation`;
  const q5 = refinedQueries[5] || topic;

  const [arxiv, crossref, pubmed, openalex, semanticscholar, dblp] = await Promise.all([
    searchArXiv(q0, 20),
    searchCrossRef(q1, 20),
    searchPubMed(q2, 15),
    searchOpenAlex(q3, 20),
    searchSemanticScholar(q4, 15),
    searchDblp(q5, 15)
  ]);

  console.log(`[Search] ArXiv:${arxiv.length} CrossRef:${crossref.length} PubMed:${pubmed.length} OpenAlex:${openalex.length} S2:${semanticscholar.length} DBLP:${dblp.length}`);

  return { arxiv, crossref, pubmed, openalex, semanticscholar, dblp };
}

module.exports = {
  searchArXiv, searchCrossRef, searchPubMed,
  searchOpenAlex, searchSemanticScholar, searchDblp,
  performFederatedSearch
};
