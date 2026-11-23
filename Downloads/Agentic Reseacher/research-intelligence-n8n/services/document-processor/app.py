"""
Document Processor Service
Extracts structured text from academic PDFs for the Research Intelligence n8n pipeline.

Endpoints:
  POST /extract  — Extract text sections from a PDF (URL or base64)
  GET  /health   — Health check
"""

import base64
import io
import logging
import os
import re
import tempfile
from typing import Optional
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, validator
import fitz  # PyMuPDF

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("document-processor")

MAX_PDF_BYTES = int(os.getenv("MAX_PDF_SIZE_MB", "50")) * 1024 * 1024
REQUEST_TIMEOUT = int(os.getenv("FETCH_TIMEOUT_SEC", "30"))

app = FastAPI(
    title="Document Processor",
    description="PDF text extraction service for Research Intelligence n8n",
    version="1.0.0",
)


class ExtractRequest(BaseModel):
    url: Optional[str] = None
    base64_pdf: Optional[str] = None

    @validator("url")
    def url_must_be_https(cls, v):
        if v is not None and not v.startswith("https://"):
            raise ValueError("URL must use HTTPS. Only HTTPS PDF URLs are accepted.")
        return v

    @validator("base64_pdf")
    def base64_not_too_large(cls, v):
        if v is not None:
            # base64 overhead is ~33%; estimate decoded size
            estimated_bytes = len(v) * 3 // 4
            if estimated_bytes > MAX_PDF_BYTES:
                raise ValueError(f"PDF exceeds maximum size of {MAX_PDF_BYTES // (1024*1024)} MB.")
        return v


class ExtractResponse(BaseModel):
    title: Optional[str]
    abstract: Optional[str]
    keywords: list[str]
    sections: dict
    full_text: str
    page_count: int
    word_count: int
    extraction_method: str
    char_count: int


SECTION_PATTERNS = {
    "abstract": re.compile(r"\babstract\b", re.IGNORECASE),
    "introduction": re.compile(r"\bintroduction\b", re.IGNORECASE),
    "literature_review": re.compile(r"\b(related work|literature review|background)\b", re.IGNORECASE),
    "methodology": re.compile(r"\b(methodology|methods|method|materials and methods)\b", re.IGNORECASE),
    "results": re.compile(r"\bresults?\b", re.IGNORECASE),
    "discussion": re.compile(r"\bdiscussion\b", re.IGNORECASE),
    "conclusion": re.compile(r"\bconclusion[s]?\b", re.IGNORECASE),
    "references": re.compile(r"\breferences?\b", re.IGNORECASE),
}


def fetch_pdf_from_url(url: str) -> bytes:
    """Download a PDF from a URL. Only HTTPS. Enforces size limit."""
    try:
        resp = requests.get(
            url,
            timeout=REQUEST_TIMEOUT,
            stream=True,
            headers={"User-Agent": "Research-Intelligence-n8n/1.0 (academic-use)"},
        )
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "")
        if "pdf" not in content_type.lower() and not url.lower().endswith(".pdf"):
            logger.warning("URL %s returned Content-Type: %s — proceeding anyway", url, content_type)

        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=65536):
            total += len(chunk)
            if total > MAX_PDF_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"PDF exceeds maximum size of {MAX_PDF_BYTES // (1024*1024)} MB.",
                )
            chunks.append(chunk)
        return b"".join(chunks)
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail=f"PDF fetch timed out after {REQUEST_TIMEOUT}s.")
    except requests.exceptions.ConnectionError as e:
        raise HTTPException(status_code=502, detail=f"Could not connect to PDF URL: {e}")
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"HTTP error fetching PDF: {e}")


def extract_text_from_pdf(pdf_bytes: bytes) -> dict:
    """Extract text from PDF bytes using PyMuPDF."""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    if doc.is_encrypted:
        raise HTTPException(status_code=422, detail="PDF is encrypted. Cannot extract text.")

    page_count = len(doc)
    full_text_parts = []

    for page_num, page in enumerate(doc):
        try:
            text = page.get_text("text")
            full_text_parts.append(text)
        except Exception as e:
            logger.warning("Failed to extract page %d: %s", page_num, e)

    doc.close()
    full_text = "\n".join(full_text_parts)
    return {"full_text": full_text, "page_count": page_count}


def segment_sections(full_text: str) -> dict:
    """
    Attempt to segment text into standard academic sections.
    Returns a dict of section_name -> text content.
    Uses heading detection: short lines matching section pattern.
    """
    lines = full_text.split("\n")
    sections = {k: [] for k in SECTION_PATTERNS}
    current_section = None
    section_order = list(SECTION_PATTERNS.keys())

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_section:
                sections[current_section].append("")
            continue

        matched = None
        # Only check lines that look like headings (short, possibly bold)
        if len(stripped) <= 60:
            for sec_name, pattern in SECTION_PATTERNS.items():
                if pattern.fullmatch(stripped) or pattern.match(stripped):
                    matched = sec_name
                    break

        if matched:
            current_section = matched
        elif current_section:
            sections[current_section].append(stripped)

    result = {}
    for k, lines_list in sections.items():
        text = " ".join(lines_list).strip()
        if text:
            result[k] = text[:8000]  # Cap each section at 8000 chars

    return result


def extract_title(full_text: str, page_count: int) -> Optional[str]:
    """Heuristic: title is often on the first page, one of the first non-empty lines."""
    first_500 = full_text[:500]
    lines = [l.strip() for l in first_500.split("\n") if l.strip()]
    if lines:
        candidate = lines[0]
        # Reject if it looks like a header (journal name, page number)
        if len(candidate) > 10 and not candidate.isdigit():
            return candidate[:200]
    return None


def extract_abstract_from_sections(sections: dict, full_text: str) -> Optional[str]:
    """Get abstract from sections, or fallback heuristic."""
    if "abstract" in sections and sections["abstract"]:
        return sections["abstract"][:2000]
    # Heuristic: find "Abstract" followed by text in full_text
    m = re.search(r"(?i)\babstract\b[\s\n]+(.{100,1500}?)(?=\n\s*\n|\b(introduction|keywords)\b)", full_text)
    if m:
        return m.group(1).strip()
    return None


def extract_keywords(full_text: str) -> list[str]:
    """Extract keywords if explicitly listed."""
    m = re.search(r"(?i)\bkeywords?\b[:\s—]+(.{10,300}?)(?:\n\n|\Z)", full_text)
    if m:
        raw = m.group(1)
        kws = [k.strip() for k in re.split(r"[;,·•]", raw) if k.strip()]
        return kws[:15]
    return []


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    """Extract text sections from a PDF provided as URL or base64."""
    if not req.url and not req.base64_pdf:
        raise HTTPException(status_code=400, detail="Provide either 'url' (HTTPS) or 'base64_pdf'.")

    extraction_method = "unknown"

    if req.base64_pdf:
        logger.info("Extracting from base64 PDF (%d chars)", len(req.base64_pdf))
        try:
            pdf_bytes = base64.b64decode(req.base64_pdf)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 encoding.")
        extraction_method = "base64"
    else:
        logger.info("Fetching PDF from URL: %s", req.url[:80])
        pdf_bytes = fetch_pdf_from_url(req.url)
        extraction_method = "url"

    result = extract_text_from_pdf(pdf_bytes)
    full_text = result["full_text"]
    page_count = result["page_count"]

    sections = segment_sections(full_text)
    title = extract_title(full_text, page_count)
    abstract = extract_abstract_from_sections(sections, full_text)
    keywords = extract_keywords(full_text)

    word_count = len(full_text.split())
    char_count = len(full_text)

    logger.info(
        "Extraction complete: %d pages, %d words, %d sections identified",
        page_count, word_count, len(sections),
    )

    return ExtractResponse(
        title=title,
        abstract=abstract,
        keywords=keywords,
        sections=sections,
        full_text=full_text[:50000],  # Cap full text at 50k chars in response
        page_count=page_count,
        word_count=word_count,
        extraction_method=extraction_method,
        char_count=char_count,
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "document-processor", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
