# Glossary

Quick reference for abbreviations, acronyms, and CortexDx-specific terminology.

## Table of Contents

- [Common Technical Abbreviations](#common-technical-abbreviations)
- [CortexDx-Specific Terms](#cortexdx-specific-terms)
- [Protocol and Standards](#protocol-and-standards)
- [Development and Testing](#development-and-testing)
- [Security and Compliance](#security-and-compliance)
- [Cloud and Infrastructure](#cloud-and-infrastructure)

---

## Common Technical Abbreviations

### API (Application Programming Interface)
A set of rules and protocols that allows different software applications to communicate with each other.

### CI/CD (Continuous Integration/Continuous Deployment)
Automated software delivery pipeline that continuously integrates code changes and deploys them to production.

**Example:** Running CortexDx diagnostics in GitHub Actions before deploying.

### CLI (Command-Line Interface)
Text-based interface for interacting with software using typed commands.

**Example:** `cortexdx diagnose https://api.example.com`

### HAR (HTTP Archive)
File format for logging and analyzing HTTP requests and responses, viewable in browser developer tools.

**Use in CortexDx:** Generate HAR files with `--har` flag to capture network traffic during diagnostics.

### JSON (JavaScript Object Notation)
Lightweight data interchange format that is easy for humans to read and machines to parse.

### NPM (Node Package Manager)
Package manager for JavaScript that manages project dependencies.

### OTel (OpenTelemetry)
Observability framework for collecting traces, metrics, and logs from applications.

**Use in CortexDx:** Send diagnostic telemetry to monitoring systems with `--otel-exporter` flag.

### SBOM (Software Bill of Materials)
Complete inventory of all software components, libraries, and dependencies in an application.

**Use in CortexDx:** Generate SBOM with `pnpm sbom` command for security audits.

### SSE (Server-Sent Events)
HTTP standard for server-to-client streaming where the server pushes updates to the client.

**Use in MCP:** CortexDx validates SSE endpoint implementation for real-time MCP communication.

### URL (Uniform Resource Locator)
Web address that specifies the location of a resource on the internet.

**Example:** `https://mcp.example.com/events`

### UUID (Universally Unique Identifier)
128-bit identifier guaranteed to be unique across space and time.

**Use in CortexDx:** Session IDs are generated as UUIDs.

---

## CortexDx-Specific Terms

### ArcTDD (Architecture Test-Driven Development)
Implementation methodology that writes tests first, then implements code to pass those tests. CortexDx generates ArcTDD plans with failing tests and remediation steps.

**Output File:** `cortexdx-arctdd.md`

### Diagnostic Suite
Collection of related checks that analyze a specific aspect of an MCP server.

**Available Suites:**
- `protocol` - MCP protocol compliance
- `security` - Security vulnerabilities
- `streaming` - SSE/WebSocket functionality
- `performance` - Performance optimization
- `governance` - Policy compliance

**Example:** `cortexdx diagnose https://api.example.com --suites protocol,security`

### Evidence Pointer
Reference to proof supporting a diagnostic finding, such as URLs, log entries, or file paths.

**Types:**
- `url` - HTTP endpoint or web resource
- `file` - Local file path
- `log` - Log entry or error message

### Finding
Issue or observation discovered during diagnostics, with severity level, description, and remediation guidance.

**Severity Levels:**
- **Blocker** - Critical issues preventing MCP functionality (exit code 1)
- **Major** - Important issues affecting reliability or security (exit code 2)
- **Minor** - Improvements that enhance quality (exit code 0)
- **Info** - Informational findings and best practices (exit code 0)

### Plugin
Modular diagnostic component that performs specific checks on an MCP server.

**Examples:** `streaming-plugin`, `cors-plugin`, `protocol-plugin`

### Stateless Analysis
Diagnostic approach that only reads from the target server without modifying state or data.

**Why it matters:** CortexDx is safe to run against production servers.

---

## Protocol and Standards

### JSON-RPC (JSON Remote Procedure Call)
Protocol for calling functions on a remote server using JSON messages.

**Version:** CortexDx validates JSON-RPC 2.0 compliance.

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### MCP (Model Context Protocol)
Protocol for connecting AI models to external data sources and tools, enabling models to access real-time information and perform actions.

**Current Version:** 2024-11-05

**Key Concepts:**
- **Tools** - Functions the AI can call
- **Resources** - Data sources the AI can access
- **Prompts** - Templates for AI interactions
- **Sampling** - AI-generated content requests

### OAuth 2.0 (Open Authorization 2.0)
Industry-standard protocol for authorization that allows applications to access user data without exposing passwords.

**Grant Types:**
- `client_credentials` - Server-to-server authentication
- `authorization_code` - User-delegated access
- `device_code` - Device/CLI authentication

### CORS (Cross-Origin Resource Sharing)
Security mechanism that allows web pages to access resources from different domains.

**Common Headers:**
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

**Use in CortexDx:** The `cors` suite validates CORS configuration.

---

## Development and Testing

### ESM (ECMAScript Modules)
Modern JavaScript module system using `import` and `export` statements.

**Example:**
```javascript
import { runDiagnose } from '@brainwav/cortexdx';
```

### LLM (Large Language Model)
AI model trained on vast amounts of text data to understand and generate human language.

**Use in CortexDx:** Local LLM integration via Ollama for conversational development assistance.

### Ollama
Local LLM runtime that runs language models on your own machine without sending data to external services.

**Installation:** `curl -fsSL https://ollama.com/install.sh | sh`

**Models:** llama3, codellama, mistral, etc.

### RAG (Retrieval-Augmented Generation)
AI technique that combines retrieval from a knowledge base with language generation for more accurate responses.

**Use in CortexDx:** Learning system uses RAG for pattern recognition and knowledge accumulation.

### TDD (Test-Driven Development)
Development methodology where tests are written before implementation code.

**Process:**
1. Write failing test (Red)
2. Write minimal code to pass (Green)
3. Refactor and optimize (Refactor)

### TypeScript
Typed superset of JavaScript that adds static type checking.

**File Extension:** `.ts`

### Vitest
Fast testing framework for JavaScript and TypeScript.

**Coverage Target:** ≥70% line coverage

---

## Security and Compliance

### ASVS (Application Security Verification Standard)
OWASP standard for web application security testing.

**Use in CortexDx:** Security control coverage enforcement with `CORTEXDX_ENFORCE_SECURITY=1`

### Auth0
Identity and access management platform for authentication and authorization.

**Integration:** CortexDx Enterprise Edition supports Auth0 for multi-tenant authentication.

### GDPR (General Data Protection Regulation)
European privacy law regulating personal data processing.

**Compliance:** CortexDx best practices include GDPR validation.

### MITRE ATT&CK
Knowledge base of adversary tactics and techniques.

**Use in CortexDx:** Threat modeling plugin references MITRE ATT&CK framework.

### OWASP (Open Web Application Security Project)
Non-profit organization focused on improving software security.

**Top 10:** Common web application security risks
- Injection
- Broken Authentication
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)

### SOC 2 (Service Organization Control 2)
Compliance framework for service providers managing customer data.

**Security Principles:**
- Security
- Availability
- Processing Integrity
- Confidentiality
- Privacy

---

## Cloud and Infrastructure

### AWS (Amazon Web Services)
Cloud computing platform providing infrastructure services.

**S3 (Simple Storage Service):** Object storage service used by CortexDx for cloud storage integration.

### Cloudflare R2
Object storage service compatible with S3 API but with zero egress fees.

**Use in CortexDx:** Cloud storage option with presigned URLs.

### Docker
Platform for developing, shipping, and running applications in containers.

**CortexDx Images:**
- `brainwav/cortexdx:1.0.0-community`
- `brainwav/cortexdx:1.0.0-professional`
- `brainwav/cortexdx:1.0.0-enterprise`

### Kubernetes (K8s)
Container orchestration platform for automating deployment, scaling, and management.

**Note:** "K8s" is a numeronym where '8' represents the 8 letters between 'K' and 's' in "Kubernetes".
**Helm Chart:** CortexDx includes Helm charts for Kubernetes deployment.

### Redis
In-memory data store used for caching and rate limiting.

**Use in CortexDx:** Distributed rate limiting in production deployments.

### WebSocket
Protocol for full-duplex communication over a single TCP connection.

**Use in MCP:** Alternative transport to SSE for real-time bidirectional communication.

---

## Development Tools

### 1Password CLI
Command-line tool for accessing secrets from 1Password vaults.

**Command:** `op run --env-file=.env -- cortexdx diagnose ...`

**Use in CortexDx:** Manage API keys and secrets securely.

### DeepContext
Semantic code search tool that understands meaning, not just keywords.

**Provider:** Wildcard

**Use in CortexDx:** Self-improvement plugin uses DeepContext for semantic code intelligence.

### Git
Distributed version control system for tracking code changes.

**Common Commands:**
- `git add` - Stage changes
- `git commit` - Save changes
- `git push` - Upload to remote

### GitHub Actions
CI/CD platform integrated with GitHub repositories.

**Workflow File:** `.github/workflows/*.yml`

### Grafana
Observability platform for visualizing metrics and logs.

**Integration:** View CortexDx diagnostic metrics via OpenTelemetry export.

### Jaeger
Distributed tracing system for monitoring microservices.

**Integration:** `--otel-exporter http://jaeger:14268`

### Mise
Tool version manager for consistent development environments.

**File:** `.mise.toml`

**Install:** `curl https://mise.run | sh`
### PNPM
Fast, disk-efficient package manager.
**Official name:** pnpm (lowercase, not an acronym)  
**Community backronym:** "Performant NPM" (informal)
**Note:** "pnpm" is the official name; "Performant NPM" is an informal backronym commonly used in the community.

**Advantages:**
- Faster than npm/yarn
- Saves disk space with content-addressable storage
- Strict dependency resolution

### Prometheus
Open-source monitoring and alerting toolkit.

**Metrics Format:** Time-series data with labels

**Integration:** Export CortexDx metrics via OpenTelemetry.

### Semgrep
Static analysis tool for finding bugs and security issues.

**Use in CortexDx:** `pnpm security:semgrep` runs MCP-focused security checks.

### SPDX (Software Package Data Exchange)
Standard format for communicating SBOM information.

**Use in CortexDx:** Generate SPDX SBOM with `pnpm sbom` command.

### Turbopuffer
Vector database for semantic search.

**Use in CortexDx:** DeepContext uses Turbopuffer for vector storage.

### OWASP ZAP (Zed Attack Proxy)
Security testing tool for finding vulnerabilities in web applications.

**Use in CortexDx:** `pnpm security:zap <url>` runs baseline security scan.

---

## Academic Research Providers

### arXiv
Open-access archive of scientific papers in physics, mathematics, computer science, and more.

**API:** Free, no authentication required

**Use in CortexDx:** Research CLI searches arXiv for relevant academic papers.

### Context7
Curated MCP research provider with indexed academic sources.

**Authentication:** Requires API key (`CONTEXT7_API_KEY`)

### Exa
Semantic web search engine that understands concepts.

**Authentication:** Requires API key (`EXA_API_KEY`)

### OpenAlex
Free and open catalog of scholarly works.

**Coverage:**  
250M+ papers, books, and datasets

**Authentication:**  
Email required (`OPENALEX_CONTACT_EMAIL`)

### Semantic Scholar
AI-powered research tool  
from Allen Institute.

**Status:**  
Preview integration (not production-ready)

**Authentication:**  
Requires API key (`SEMANTIC_SCHOLAR_API_KEY`)

### Vibe Check
Research validation provider for MCP patterns.

**Authentication:** Optional API key (`VIBE_CHECK_API_KEY`)

**Configuration:** `VIBE_CHECK_HTTP_URL`, `VIBE_CHECK_PROFILE`

### Wikidata
Free knowledge base with structured data.

**API:** Free, no authentication required

**Coverage:** 100M+ entities

---

## Quick Reference

### Exit Codes
- **0** - Success (no blockers or majors)
- **1** - Blocker findings detected
- **2** - Major findings detected

### File Outputs
- `cortexdx-report.md` - Human-readable report
- `cortexdx-findings.json` - Machine-readable findings
- `cortexdx-arctdd.md` - Test-driven implementation plan
- `cortexdx-fileplan.patch` - Unified diff patches
- `cortexdx-*.har` - HTTP archive (with `--har` flag)

### Common Environment Variables
- `CORTEXDX_LLM_BACKEND` - LLM backend (must be `ollama`)
- `CORTEXDX_OUTPUT_DIR` - Output directory path
- `CORTEXDX_BUDGET_TIME` - Per-plugin timeout (ms)
- `CORTEXDX_BUDGET_MEM` - Per-plugin memory limit (MB)
- `DEBUG=cortexdx:*` - Enable debug logging

### Diagnostic Suite IDs
- `protocol` - MCP protocol compliance
- `jsonrpc` - JSON-RPC 2.0 validation
- `streaming` - SSE/WebSocket checks
- `security` - Security vulnerabilities
- `cors` - CORS configuration
- `auth` - Authentication mechanisms
- `ratelimit` - Rate limiting policies
- `governance` - Policy compliance
- `performance-analysis` - Performance profiling
- `threat-model` - Security assessment

---

## Related Documentation

- [Getting Started Guide](./GETTING_STARTED.md) - Installation and first steps
- [User Guide](./USER_GUIDE.md) - Comprehensive usage documentation
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Main README](../README.md) - Project overview

---

*Last updated: 2025-11-17*
