/**
 * Paper Normalization & Deduplication Module
 * Ported from n8n Workflow 'Aggregate & Deduplicate Results' node
 */

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

function generateId() {
  return 'paper_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Normalizes papers from ArXiv, CrossRef, PubMed, and OpenAlex,
 * removes duplicates based on normalized titles and DOIs,
 * and sorts by citation count / relevance.
 */
function aggregateAndDeduplicate(sources) {
  const normalizedPapers = [];
  const seenTitles = new Set();
  const seenDois = new Set();

  const { arxiv = [], crossref = [], pubmed = [], openalex = [], semanticscholar = [], dblp = [] } = sources;

  // 1. Process ArXiv results
  arxiv.forEach(entry => {
    const title = cleanText(entry.title);
    const doi = entry.doi || '';
    if (!title || seenTitles.has(title.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());

    normalizedPapers.push({
      id: generateId(),
      title: title,
      authors: Array.isArray(entry.authors) ? entry.authors.join(', ') : cleanText(entry.authors || 'Unknown Authors'),
      year: entry.year || 'N/A',
      abstract: cleanText(entry.abstract) || 'Abstract not available',
      doi: doi,
      citations: entry.citations || 0,
      journal: entry.journal || 'arXiv Preprint',
      source: 'ArXiv',
      fields: entry.fields || 'Computer Science / Physics / Math',
      pdf_url: entry.pdf_url || (entry.id ? `https://arxiv.org/pdf/${entry.id}.pdf` : '')
    });
  });

  // 2. Process CrossRef results
  crossref.forEach(item => {
    const title = cleanText(Array.isArray(item.title) ? item.title[0] : item.title);
    const doi = item.DOI || '';
    if (!title || seenTitles.has(title.toLowerCase())) return;
    if (doi && seenDois.has(doi.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());

    let authors = 'Unknown Authors';
    if (item.author && Array.isArray(item.author)) {
      authors = item.author.map(a => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean).join(', ');
    }

    let year = 'N/A';
    if (item['published-print']?.['date-parts']?.[0]?.[0]) {
      year = String(item['published-print']['date-parts'][0][0]);
    } else if (item['published-online']?.['date-parts']?.[0]?.[0]) {
      year = String(item['published-online']['date-parts'][0][0]);
    } else if (item.created?.['date-parts']?.[0]?.[0]) {
      year = String(item.created['date-parts'][0][0]);
    }

    normalizedPapers.push({
      id: generateId(),
      title: title,
      authors: authors || 'Unknown Authors',
      year: year,
      abstract: cleanText(item.abstract) || 'Abstract not available',
      doi: doi,
      citations: item['is-referenced-by-count'] || 0,
      journal: (item['container-title'] && item['container-title'][0]) || 'Academic Journal',
      source: 'CrossRef',
      fields: (item.subject || []).join(', ') || 'Interdisciplinary',
      pdf_url: item.link?.[0]?.URL || (doi ? `https://doi.org/${doi}` : '')
    });
  });

  // 3. Process PubMed results
  pubmed.forEach(item => {
    const title = cleanText(item.title);
    const doi = item.doi || '';
    if (!title || seenTitles.has(title.toLowerCase())) return;
    if (doi && seenDois.has(doi.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());

    normalizedPapers.push({
      id: generateId(),
      title: title,
      authors: item.authors || 'Unknown Authors',
      year: item.year || 'N/A',
      abstract: cleanText(item.abstract) || 'Abstract not available',
      doi: doi,
      citations: item.citations || 0,
      journal: item.journal || 'Biomedical Journal',
      source: 'PubMed',
      fields: 'Biomedicine / Health Sciences',
      pdf_url: item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : ''
    });
  });

  // 4. Process OpenAlex results
  openalex.forEach(item => {
    const title = cleanText(item.title);
    const doi = (item.doi || '').replace('https://doi.org/', '');
    if (!title || seenTitles.has(title.toLowerCase())) return;
    if (doi && seenDois.has(doi.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());

    let authors = 'Unknown Authors';
    if (item.authorships && Array.isArray(item.authorships)) {
      authors = item.authorships.map(a => a.author?.display_name).filter(Boolean).join(', ');
    }

    let abstract = 'Abstract not available';
    if (item.abstract_inverted_index) {
      try {
        const words = [];
        for (const [word, positions] of Object.entries(item.abstract_inverted_index)) {
          for (const pos of positions) {
            words[pos] = word;
          }
        }
        abstract = words.filter(Boolean).join(' ');
      } catch (e) {
        abstract = 'Abstract not available';
      }
    }

    normalizedPapers.push({
      id: generateId(),
      title: title,
      authors: authors || 'Unknown Authors',
      year: String(item.publication_year || 'N/A'),
      abstract: cleanText(abstract),
      doi: doi,
      citations: item.cited_by_count || 0,
      journal: item.primary_location?.source?.display_name || 'Scholarly Venue',
      source: 'OpenAlex',
      fields: (item.concepts || []).slice(0, 3).map(c => c.display_name).join(', ') || 'Computer Science',
      pdf_url: item.primary_location?.pdf_url || item.doi || ''
    });
  });

  // 5. Process Semantic Scholar results
  semanticscholar.forEach(item => {
    const title = cleanText(item.title);
    const doi = item.doi || '';
    if (!title || seenTitles.has(title.toLowerCase())) return;
    if (doi && seenDois.has(doi.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());

    normalizedPapers.push({
      id: generateId(),
      title,
      authors: item.authors || 'Unknown Authors',
      year: String(item.year || 'N/A'),
      abstract: cleanText(item.abstract) || 'Abstract not available',
      doi,
      citations: item.citations || 0,
      journal: item.journal || 'Semantic Scholar',
      source: 'Semantic Scholar',
      fields: item.fields || 'Interdisciplinary',
      pdf_url: doi ? `https://doi.org/${doi}` : ''
    });
  });

  // 6. Process DBLP results
  dblp.forEach(item => {
    const title = cleanText(item.title);
    const doi = item.doi || '';
    if (!title || seenTitles.has(title.toLowerCase())) return;
    if (doi && seenDois.has(doi.toLowerCase())) return;
    seenTitles.add(title.toLowerCase());
    if (doi) seenDois.add(doi.toLowerCase());
    normalizedPapers.push({
      id: generateId(), title,
      authors: item.authors || 'Unknown Authors',
      year: String(item.year || 'N/A'),
      abstract: 'Abstract available via DBLP / publisher page.',
      doi, citations: 0,
      journal: item.journal || 'DBLP',
      source: 'DBLP',
      fields: 'Computer Science / Engineering',
      pdf_url: item.url || (doi ? `https://doi.org/${doi}` : '')
    });
  });

  // Sort: citation-weighted, recency as tiebreaker
  normalizedPapers.sort((a, b) => {
    const citeDiff = (b.citations || 0) - (a.citations || 0);
    if (citeDiff !== 0) return citeDiff;
    return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
  });

  return normalizedPapers;
}

module.exports = {
  aggregateAndDeduplicate,
  cleanText
};
