# Requirements Document

## Introduction

Insula MCP is a diagnostic meta-inspector designed to proactively identify security, performance, and compliance issues in MCP (Model Context Protocol) servers before they reach production. The system provides evidence-linked findings with actionable remediation plans, supporting the brAInwav governance framework with TDD, accessibility compliance (WCAG 2.2 AA), and comprehensive security scanning.

## Glossary

- **Insula_MCP_System**: The diagnostic meta-inspector system that validates MCP servers for security, performance, and compliance issues
- **MCP_Server**: A Model Context Protocol server that provides tools, resources, and prompts to AI agents
- **Diagnostic_Plugin**: A sandboxed module that performs specific security, performance, or compliance checks
- **Finding**: A discovered issue with severity level (info, minor, major, blocker) and evidence pointers
- **Evidence_Pointer**: A reference to specific files, URLs, or log entries that support a finding
- **File_Plan**: A collection of patches and diffs that can be applied to remediate findings
- **ArcTDD_Plan**: A structured remediation plan following the brAInwav ArcTDD methodology
- **Worker_Sandbox**: An isolated Node.js worker thread with CPU/memory budgets for plugin execution
- **Diagnostic_Context**: The runtime environment provided to plugins with adapters and utilities
- **SSE_Endpoint**: Server-Sent Events endpoint used for streaming MCP progress notifications
- **Tool_Classification**: Risk assessment system that categorizes MCP tools by privilege level and capabilities
- **Academic_Provider**: A FASTMCP v3.22 compliant module that interfaces with scholarly research APIs
- **Provider_Registry**: A centralized system for registering and discovering academic research providers
- **Research_Quality_Assessment**: Automated validation of academic methodology and integrity standards
- **Semantic_Scholar_Integration**: Academic provider for paper search and citation analysis capabilities
- **OpenAlex_Provider**: Scholarly work and author research functionality provider
- **Wikidata_SPARQL_Queries**: Knowledge graph access through SPARQL query capabilities
- **arXiv_Provider**: Preprint search and metadata extraction functionality
- **Vibe_Check_Provider**: Research quality and methodology assessment provider
- **Context7_Integration**: Contextual research analysis and cross-referencing provider
- **Academic_Providers**: Collection of research-focused MCP providers under registry.providers.academic
- **FASTMCP_v3_22_Compliance**: Adherence to FASTMCP version 3.22 protocol specifications
- **Worker_Thread**: Node.js worker thread execution environment with resource constraints
- **Fail_On_Minor**: Configuration option to treat minor severity findings as build failures
- **A11y_Option**: Accessibility configuration for screen reader compatible output
- **File_Plan_Option**: Configuration to enable generation of remediation patches and diffs

## Requirements

### Requirement 1

**User Story:** As a security engineer, I want to scan MCP servers for authentication vulnerabilities, so that I can prevent unauthorized access to sensitive tools and resources.

#### Acceptance Criteria

1. WHEN THE Insula_MCP_System receives an endpoint URL, THE Insula_MCP_System SHALL attempt unauthenticated discovery calls
2. IF THE MCP_Server responds to tool discovery without authentication, THEN THE Insula_MCP_System SHALL generate a BLOCKER severity finding
3. THE Insula_MCP_System SHALL test multiple authentication schemes including Bearer tokens, Basic auth, and custom headers
4. THE Insula_MCP_System SHALL detect authentication bypass vulnerabilities and header case sensitivity issues
5. THE Insula_MCP_System SHALL provide evidence pointers to specific endpoints and response headers

### Requirement 2

**User Story:** As a DevOps engineer, I want to validate streaming endpoints for production readiness, so that I can ensure SSE connections work reliably behind proxies and CDNs.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL probe SSE endpoints for proper content-type headers and streaming behavior
2. THE Insula_MCP_System SHALL verify retry directives and Last-Event-ID support for reconnection handling
3. WHEN THE SSE_Endpoint lacks proper buffering headers, THE Insula_MCP_System SHALL generate remediation patches for common proxy configurations
4. THE Insula_MCP_System SHALL test heartbeat mechanisms and connection persistence
5. THE Insula_MCP_System SHALL validate chunked encoding and compression settings

### Requirement 3

**User Story:** As a compliance officer, I want to assess tool permissioning against least-privilege principles, so that I can ensure MCP servers don't expose overly broad capabilities.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL enumerate all available tools via JSON-RPC discovery
2. THE Insula_MCP_System SHALL classify tools by risk level using heuristic pattern matching
3. WHEN THE Tool_Classification detects high-risk capabilities like filesystem or shell access, THE Insula_MCP_System SHALL generate MAJOR severity findings
4. THE Insula_MCP_System SHALL provide confidence scores for permissioning assessments
5. THE Insula_MCP_System SHALL recommend confirmation prompts and scoping restrictions

### Requirement 4

**User Story:** As a developer, I want comprehensive diagnostic reports with actionable remediation steps, so that I can quickly fix identified issues.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL generate findings in both Markdown and JSON formats
2. THE Insula_MCP_System SHALL create ArcTDD remediation plans prioritizing blockers and majors
3. WHERE THE File_Plan_Option is enabled, THE Insula_MCP_System SHALL generate unified diff patches
4. THE Insula_MCP_System SHALL include evidence pointers with file paths, line numbers, and URLs
5. THE Insula_MCP_System SHALL provide confidence scores and remediation code samples

### Requirement 5

**User Story:** As a CI/CD engineer, I want exit codes that reflect finding severity, so that I can fail builds on critical security issues.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL exit with code 1 when BLOCKER severity findings are present
2. THE Insula_MCP_System SHALL exit with code 2 when MAJOR severity findings are present
3. WHERE THE Fail_On_Minor option is specified, THE Insula_MCP_System SHALL exit with code 2 for MINOR findings
4. THE Insula_MCP_System SHALL exit with code 0 when only INFO severity findings are present
5. THE Insula_MCP_System SHALL generate SBOM artifacts and upload diagnostic reports

### Requirement 6

**User Story:** As a security researcher, I want plugin sandboxing with resource limits, so that I can safely run diagnostic plugins without system compromise.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL execute each plugin in an isolated Node.js worker thread
2. THE Insula_MCP_System SHALL enforce configurable time budgets with default 5000ms timeout
3. THE Insula_MCP_System SHALL enforce memory limits with default 96MB old-space allocation
4. WHEN THE Worker_Thread fails to initialize, THE Insula_MCP_System SHALL fallback to in-process execution
5. THE Insula_MCP_System SHALL deny filesystem and child_process access within plugin sandboxes

### Requirement 7

**User Story:** As an accessibility advocate, I want CLI output that supports screen readers, so that visually impaired developers can use the diagnostic tools effectively.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL prefix severity levels with text markers ([BLOCKER], [MAJOR], [MINOR], [INFO])
2. THE Insula_MCP_System SHALL avoid color-only signaling for status indication
3. WHERE THE A11y_Option is enabled, THE Insula_MCP_System SHALL provide summary-first output mode
4. THE Insula_MCP_System SHALL support keyboard navigation help with ? key
5. THE Insula_MCP_System SHALL comply with WCAG 2.2 AA accessibility standards

### Requirement 8

**User Story:** As a threat modeler, I want STRIDE-based security assessments, so that I can identify potential attack vectors in MCP server configurations.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL perform spoofing checks against authentication schemes
2. THE Insula_MCP_System SHALL detect tampering risks in mutable tool surfaces
3. THE Insula_MCP_System SHALL validate logging and audit trail capabilities
4. THE Insula_MCP_System SHALL identify information disclosure risks in tool descriptions
5. THE Insula_MCP_System SHALL assess denial-of-service vulnerabilities in streaming endpoints

### Requirement 9

**User Story:** As a performance engineer, I want baseline latency measurements, so that I can establish SLA baselines and detect performance regressions.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL measure response times for JSON-RPC calls
2. THE Insula_MCP_System SHALL test timeout handling and circuit breaker behavior
3. THE Insula_MCP_System SHALL validate rate limiting with proper Retry-After headers
4. THE Insula_MCP_System SHALL generate performance findings with latency measurements
5. THE Insula_MCP_System SHALL provide recommendations for timeout and retry configurations

### Requirement 10

**User Story:** As a governance officer, I want policy drift detection, so that I can ensure MCP servers remain compliant with organizational standards over time.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL detect presence of .cortex governance packs
2. THE Insula_MCP_System SHALL validate policy version consistency across deployments
3. THE Insula_MCP_System SHALL check for governance rule violations and exceptions
4. THE Insula_MCP_System SHALL generate MAJOR findings when governance packs are missing
5. THE Insula_MCP_System SHALL provide remediation steps for governance compliance

### Requirement 11

**User Story:** As a researcher, I want integrated academic research providers, so that I can validate and interact with scholarly data sources through standardized MCP interfaces.

#### Acceptance Criteria

1. THE Insula_MCP_System SHALL provide Semantic_Scholar_Integration for paper search and citation analysis
2. THE Insula_MCP_System SHALL include OpenAlex_Provider for scholarly work and author research
3. THE Insula_MCP_System SHALL support Wikidata_SPARQL_Queries for knowledge graph access
4. THE Insula_MCP_System SHALL integrate arXiv_Provider for preprint search and metadata extraction
5. THE Insula_MCP_System SHALL include Vibe_Check_Provider for research quality assessment
6. THE Insula_MCP_System SHALL provide Context7_Integration for contextual research analysis
7. THE Insula_MCP_System SHALL register all Academic_Providers under registry.providers.academic
8. WHERE THE Academic_Provider is accessed, THE Insula_MCP_System SHALL ensure FASTMCP_v3_22_Compliance
