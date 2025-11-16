# CortexDx Glossary

**Quick reference for technical terms and acronyms used throughout the CortexDx documentation.**

> 💡 **Tip:** Press `Ctrl+F` (or `Cmd+F` on Mac) to search for specific terms.

---

## Table of Contents

- [MCP Protocol Terms](#mcp-protocol-terms)
- [Diagnostic Terms](#diagnostic-terms)
- [Architecture Terms](#architecture-terms)
- [Security Terms](#security-terms)
- [Development Terms](#development-terms)
- [Tooling Terms](#tooling-terms)

---

## MCP Protocol Terms

### MCP (Model Context Protocol)
A standardized protocol for communication between AI models and external tools/services. Defines how AI assistants can discover, invoke, and interact with external capabilities.

**Related:** [MCP Specification](https://modelcontextprotocol.io/)

### JSON-RPC (JSON Remote Procedure Call)
A lightweight remote procedure call protocol encoded in JSON. MCP uses JSON-RPC 2.0 for structured communication between clients and servers.

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

### SSE (Server-Sent Events)
A server push technology enabling servers to send real-time updates to clients over HTTP. Used by MCP for streaming responses and live notifications.

**Related:** [MDN Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

### Tool
An MCP capability that performs a specific action (e.g., search files, make API calls). Tools are discoverable and invocable by AI assistants.

**Example:** A `search_web` tool that queries search engines.

### Resource
An MCP data source that can be read by AI assistants (e.g., files, database records). Resources are identified by URIs.

**Example:** `file:///path/to/document.pdf`

### Prompt
A template or pattern that guides AI assistant behavior. MCP servers can expose prompts for clients to use.

### Transport
The communication layer used by MCP (HTTP, WebSocket, stdio, SSE). Defines how messages are sent between client and server.

### Session
A stateful connection between an MCP client and server, initiated with an `initialize` request.

**Session Lifecycle:** Connect → Initialize → Exchange Messages → Close

### Capabilities
Features and abilities advertised by an MCP server during handshake (e.g., which tools, resources, or prompts are available).

---

## Diagnostic Terms

### Finding
A detected issue or observation discovered during diagnostic analysis. Findings have severity levels (blocker, major, minor, info).

### Severity
The importance level of a finding:
- **Blocker**: Critical issues preventing MCP functionality
- **Major**: Important issues affecting reliability or security
- **Minor**: Improvements that enhance quality
- **Info**: Informational findings and best practices

### Evidence
Concrete data supporting a finding (e.g., HTTP response codes, headers, timing measurements). All CortexDx findings include verifiable evidence.

### Suite
A collection of related diagnostic tests (e.g., `protocol`, `security`, `streaming`). Suites can be run individually or combined.

### Plugin
A diagnostic module that performs specific validation or analysis. CortexDx uses a plugin-first architecture.

**Example:** The `streaming` plugin validates SSE endpoints.

### Confidence Level
How certain CortexDx is about a finding (high, medium, low). High-confidence findings have 95%+ accuracy.

### Remediation
Suggested fixes and steps to resolve a finding. Includes code examples and references.

### ArcTDD (Architecture-Test-Driven Development)
CortexDx's implementation plan format that provides test-driven remediation guidance in ordered "arcs" (phases).

---

## Architecture Terms

### Stateless
Each diagnostic run is independent with no persistent state between runs. Enables reliable, reproducible results.

### Sandbox
An isolated execution environment for plugins with resource limits (CPU time, memory). Prevents untrusted plugins from affecting the host system.

### Worker Thread
A separate JavaScript thread that runs plugins in isolation from the main process.

### Budget
Resource limits for plugin execution:
- **Time Budget**: Maximum execution time (default: 5000ms)
- **Memory Budget**: Maximum RAM usage (default: 96MB)

### Deterministic Mode
A mode where CortexDx produces consistent, reproducible results by using stable timestamps and random seeds. Essential for CI/CD.

### Orchestrator
The component that coordinates plugin execution, manages the diagnostic workflow, and aggregates results.

### Context
The execution environment provided to plugins, including MCP session, configuration, and utilities.

### LangGraph
A framework for building stateful, multi-actor workflows. Used by CortexDx for self-healing diagnostics.

### Checkpoint
A saved state in a LangGraph workflow, allowing resumption from specific points.

---

## Security Terms

### CORS (Cross-Origin Resource Sharing)
A browser security mechanism controlling which origins can access a web server's resources. Misconfigured CORS is a common vulnerability.

**Secure Example:** `Access-Control-Allow-Origin: https://trusted.com`
**Insecure Example:** `Access-Control-Allow-Origin: *`

### Authentication
The process of verifying identity. CortexDx supports bearer tokens, basic auth, API keys, and OAuth2.

### Authorization
The process of determining what authenticated users can access.

### Rate Limiting
Restricting the number of requests a client can make in a time period. Prevents abuse and DoS attacks.

**Example:** 100 requests per minute per client.

### Threat Model
A structured analysis of potential security vulnerabilities and attack vectors.

### OWASP (Open Web Application Security Project)
A nonprofit foundation focused on improving software security. CortexDx validates against OWASP Top 10 vulnerabilities.

### HAR (HTTP Archive)
A JSON format for logging HTTP transactions. CortexDx can capture HAR files with `--har` flag (sensitive data is redacted).

### ASVS (Application Security Verification Standard)
OWASP's framework for testing web application security controls.

### SBOM (Software Bill of Materials)
A comprehensive inventory of software components and dependencies. CortexDx can generate SBOM in CycloneDX and SPDX formats.

---

## Development Terms

### TypeScript
A strongly-typed superset of JavaScript. CortexDx is written in TypeScript for type safety and developer experience.

### ESM (ECMAScript Modules)
Modern JavaScript module system using `import` and `export`. CortexDx uses ESM exclusively.

### Vitest
A fast unit testing framework for JavaScript/TypeScript. CortexDx uses Vitest for all tests.

### Biome
A fast linter and formatter for JavaScript/TypeScript. Replaces ESLint and Prettier in CortexDx.

### pnpm
A fast, disk-efficient package manager. CortexDx uses pnpm for dependency management.

### Mise
A tool version manager (formerly rtx). Manages Node.js, pnpm, and other toolchain versions.

### Monorepo
A single repository containing multiple related packages. CortexDx uses an Nx-powered monorepo.

### Mutation Testing
A testing technique that modifies code to verify test effectiveness. CortexDx requires ≥75% mutation score.

### Coverage
The percentage of code executed by tests:
- **Line Coverage**: Percentage of lines executed
- **Branch Coverage**: Percentage of conditional branches tested
- **Function Coverage**: Percentage of functions called

**CortexDx Requirements:** ≥85% line/statement coverage, ≥80% function coverage, ≥75% branch coverage

---

## Tooling Terms

### CLI (Command-Line Interface)
A text-based interface for running programs. CortexDx is primarily a CLI tool.

**Example:** `cortexdx diagnose https://api.example.com`

### OpenTelemetry (OTel)
An observability framework for distributed tracing, metrics, and logging. CortexDx supports OTel export.

### Docker
A containerization platform for packaging applications with their dependencies. CortexDx provides official Docker images.

### Kubernetes (K8s)
A container orchestration platform. CortexDx includes Helm charts for K8s deployment.

### CI/CD (Continuous Integration / Continuous Deployment)
Automated testing and deployment workflows. CortexDx integrates with GitHub Actions, GitLab CI, and Jenkins.

### Webhook
An HTTP callback that sends real-time data to other applications. CortexDx can send results to Slack, Teams, etc.

### npx
A tool for running npm packages without global installation.

**Example:** `npx @brainwav/cortexdx diagnose <endpoint>`

### LaunchAgent (macOS)
A macOS background service managed by `launchd`. CortexDx provides LaunchAgent scripts for daemon mode.

### Cloudflare Tunnel (cloudflared)
A service that creates secure tunnels to expose local servers. Used to expose CortexDx publicly.

---

## LLM Terms

### LLM (Large Language Model)
An AI model trained on vast text datasets. CortexDx uses LLMs for conversational assistance and code generation.

### Ollama
A local LLM runtime that runs models on your machine. CortexDx's preferred LLM backend for privacy and offline use.

### RAG (Retrieval-Augmented Generation)
A technique combining LLM generation with information retrieval. CortexDx uses RAG for pattern learning.

### Embedding
A vector representation of text used for semantic search and similarity matching.

### Deterministic LLM
An LLM with consistent outputs for the same input, achieved by setting fixed random seeds.

---

## Network Terms

### Endpoint
A network address where an MCP server is accessible.

**Example:** `https://api.example.com/mcp`

### HTTP Status Codes
Numeric codes indicating the result of HTTP requests:
- **2xx**: Success (200 OK, 201 Created)
- **4xx**: Client errors (400 Bad Request, 404 Not Found)
- **5xx**: Server errors (500 Internal Server Error, 502 Bad Gateway)

### Proxy
An intermediary server that forwards requests between clients and servers.

### WebSocket
A protocol providing full-duplex communication over a single TCP connection. Used for real-time, bidirectional MCP communication.

### gRPC
A high-performance RPC framework. CortexDx has beta support for gRPC-based MCP servers.

---

## Abbreviations

| Abbreviation | Full Term | Category |
|--------------|-----------|----------|
| **API** | Application Programming Interface | Development |
| **CLI** | Command-Line Interface | Tooling |
| **CORS** | Cross-Origin Resource Sharing | Security |
| **CI/CD** | Continuous Integration/Deployment | Tooling |
| **CPU** | Central Processing Unit | Architecture |
| **DoS** | Denial of Service | Security |
| **ESM** | ECMAScript Modules | Development |
| **GDPR** | General Data Protection Regulation | Compliance |
| **GPG** | GNU Privacy Guard | Security |
| **gRPC** | gRPC Remote Procedure Call | Network |
| **HAR** | HTTP Archive | Security |
| **HTTP** | Hypertext Transfer Protocol | Network |
| **HTTPS** | HTTP Secure | Network |
| **JSON** | JavaScript Object Notation | Development |
| **JWT** | JSON Web Token | Security |
| **K8s** | Kubernetes | Tooling |
| **LLM** | Large Language Model | AI |
| **MCP** | Model Context Protocol | Protocol |
| **OAuth** | Open Authorization | Security |
| **OTel** | OpenTelemetry | Tooling |
| **OWASP** | Open Web Application Security Project | Security |
| **RAM** | Random Access Memory | Architecture |
| **RAG** | Retrieval-Augmented Generation | AI |
| **RBAC** | Role-Based Access Control | Security |
| **REST** | Representational State Transfer | Network |
| **RPC** | Remote Procedure Call | Network |
| **SARIF** | Static Analysis Results Interchange Format | Security |
| **SBOM** | Software Bill of Materials | Security |
| **SOC 2** | Service Organization Control 2 | Compliance |
| **SPDX** | Software Package Data Exchange | Security |
| **SSH** | Secure Shell | Security |
| **SSE** | Server-Sent Events | Network |
| **TDD** | Test-Driven Development | Development |
| **TLS** | Transport Layer Security | Security |
| **URI** | Uniform Resource Identifier | Network |
| **URL** | Uniform Resource Locator | Network |
| **WCAG** | Web Content Accessibility Guidelines | Accessibility |
| **YAML** | YAML Ain't Markup Language | Development |

---

## Related Documentation

- **[Getting Started Guide](../packages/cortexdx/docs/GETTING_STARTED.md)** - First steps with CortexDx
- **[User Guide](../packages/cortexdx/docs/USER_GUIDE.md)** - Comprehensive usage documentation
- **[Architecture](ARCHITECTURE.md)** - System design and components
- **[MCP Specification](https://modelcontextprotocol.io/)** - Official protocol documentation

---

## Contributing to This Glossary

Found a term that's not defined? Please contribute!

1. Check if the term is already listed
2. Add the term in alphabetical order within its category
3. Provide a clear, beginner-friendly definition
4. Include an example where helpful
5. Link to authoritative sources when available

See [CONTRIBUTING.md](../CONTRIBUTING.md) for submission guidelines.

---

**Last Updated:** 2025-11-16
**Maintainers:** CortexDx Documentation Team
