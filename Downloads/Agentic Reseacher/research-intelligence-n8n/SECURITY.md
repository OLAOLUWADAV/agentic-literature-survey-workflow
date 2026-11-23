# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | No (original workflow — do not use) |

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability, email the maintainers directly with:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Your suggested fix (if you have one)

You will receive an acknowledgement within 48 hours and a resolution timeline within 7 days.

---

## Security model

### What this system protects

1. **API keys:** All API keys are stored only in environment variables. No key is written to workflow JSON, logs, or database records.

2. **n8n encryption:** n8n encrypts credentials at rest using `N8N_ENCRYPTION_KEY`. This key must be generated randomly and kept secret.

3. **Network isolation:** In the Docker Compose setup, all services run in an internal network. Only n8n port 5678 is exposed. The document processor (port 8080) and PostgreSQL (port 5432) are not publicly accessible.

4. **Non-root containers:** The document processor service runs as a non-root user (`docproc`).

5. **Signed PDF reads:** PDFs processed by the document processor are read in memory only — they are never stored to disk.

### What this system does NOT protect

1. **n8n execution logs:** n8n stores execution logs that may contain paper abstracts and research topics. These logs are stored in the n8n database (PostgreSQL in the Docker Compose setup). Access to the n8n UI gives access to these logs.

2. **LLM provider:** Your research topic and paper abstracts are sent to your configured LLM provider. If this is sensitive, use a local Ollama instance.

3. **Search queries:** Your search queries are sent to ArXiv, CrossRef, PubMed, OpenAlex, and Semantic Scholar. These are public databases — the queries themselves are not sensitive, but they are logged by those services.

4. **Output files:** Reports written to `OUTPUT_DIR` are unencrypted files. Secure the output directory using filesystem permissions.

---

## Hardening recommendations

For production deployments:

### Authentication
- Change `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` from defaults
- Use a strong, unique password (20+ characters)
- Consider adding a reverse proxy (nginx/Caddy) with HTTPS before n8n

### Secrets
- Generate `N8N_ENCRYPTION_KEY` with `openssl rand -hex 32` — do not reuse keys across instances
- Use a secrets manager (HashiCorp Vault, AWS Secrets Manager) in production instead of `.env`
- Rotate API keys if they are exposed

### Network
- Do not expose the document processor (port 8080) to the public internet — it has no authentication
- Use a firewall to restrict access to n8n port 5678
- If exposing n8n publicly, put it behind HTTPS with a valid certificate

### Data
- Review n8n execution retention settings — reduce log retention if research topics are sensitive
- Back up the PostgreSQL database if you need to preserve research history
- Set appropriate filesystem permissions on `OUTPUT_DIR`

### Updates
- Keep n8n updated — subscribe to the n8n security mailing list
- Keep PostgreSQL updated
- Rebuild the document processor Docker image periodically to get security patches in base layers

---

## Prompt injection

Academic paper abstracts are untrusted external data. This system mitigates prompt injection by:
- Embedding paper content in structured JSON format in LLM prompts
- Using system-role instructions to establish task context before paper content

If you notice LLM analysis outputs that contain unusual instructions, links, or off-topic content, check the source paper's abstract for suspicious patterns and report it.
