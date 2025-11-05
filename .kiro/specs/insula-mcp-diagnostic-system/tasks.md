# Implementation Plan

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for models, services, repositories, and API components
  - Define interfaces that establish system boundaries
  - _Requirements: 1.1_

- [x] 2. Implement core diagnostic framework
- [x] 2.1 Create diagnostic context and plugin interfaces
  - Write TypeScript interfaces for DiagnosticContext, DiagnosticPlugin, and Finding
  - Implement evidence pointer and file plan data structures
  - _Requirements: 4.1, 4.4_

- [x] 2.2 Build plugin host with sandboxing capabilities
  - Implement worker thread creation with resource limits
  - Add timeout and memory budget enforcement
  - Create fallback to in-process execution
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2.3 Develop diagnostic orchestrator
  - Code plugin selection logic based on suites and full mode
  - Implement result aggregation and severity assessment
  - Add exit code determination for CI/CD integration
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Create FASTMCP protocol adapters
- [x] 3.1 Implement HTTP transport adapter
  - Write standardized HTTP request handling with error management
  - Add automatic JSON/text response parsing
  - _Requirements: 1.1, 2.1_

- [x] 3.2 Build FASTMCP v3.22 JSON-RPC client adapter
  - Implement FASTMCP v3.22 compliant JSON-RPC 2.0 client
  - Add initialization handshake and capability negotiation
  - Handle FASTMCP method routing and versioning
  - _Requirements: 1.3, 2.1, 8.1_

- [x] 3.3 Create FASTMCP SSE adapter
  - Implement Server-Sent Events probing for FASTMCP progress notifications
  - Add event parsing with eventsource-parser for FASTMCP message formats
  - Handle timeout and abort signals for long-running operations
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 4. Implement core diagnostic plugins
- [x] 4.1 Build DevTool Environment plugin
  - Check for known CVEs in development tools
  - Validate MCP Inspector versions
  - _Requirements: 8.1_

- [x] 4.2 Create FASTMCP Authentication plugin
  - Test unauthenticated access to discovery endpoints
  - Validate multiple authentication schemes (Bearer, Basic, custom headers)
  - Detect authentication bypass vulnerabilities
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 4.3 Implement FASTMCP Discovery plugin
  - Enumerate tools, prompts, and resources via FASTMCP v3.22 endpoints
  - Test discovery methods and validate response schemas
  - Verify capability negotiation and version handshake
  - _Requirements: 1.1, 3.1, 8.1_

- [x] 4.4 Build FASTMCP Protocol plugin
  - Validate FASTMCP v3.22 JSON-RPC 2.0 conformance
  - Test initialization handshake and version negotiation
  - Verify method signatures and error handling
  - _Requirements: 1.3, 8.1, 8.2_

- [x] 5. Implement advanced diagnostic plugins
- [x] 5.1 Create JSON-RPC Batch plugin
  - Test batch request handling for multiple tool calls
  - Validate notification processing and mixed ID types
  - _Requirements: 8.2, 8.3_

- [x] 5.2 Build Tool Permissioning plugin
  - Analyze FASTMCP tool capabilities for over-privileging
  - Apply heuristic risk classification to tool descriptions
  - Generate confidence scores for assessments
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.3 Implement Streaming SSE plugin
  - Test FASTMCP Server-Sent Events endpoints
  - Validate SSE message formats and event types
  - Test streaming tool execution progress
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5.4 Create SSE Reconnect plugin
  - Test retry directives and Last-Event-ID support
  - Validate reconnection mechanisms and heartbeat
  - _Requirements: 2.2, 2.4_

- [x] 5.5 Build CORS plugin
  - Test preflight requests across FASTMCP routes
  - Validate CORS header configurations
  - _Requirements: 8.1, 8.2_

- [x] 5.6 Implement Rate Limit plugin
  - Test 429 responses and Retry-After headers
  - Validate backoff mechanisms
  - _Requirements: 9.3, 9.5_

- [x] 6. Implement security and governance plugins
- [x] 6.1 Create Tool Drift plugin
  - Detect mutable FASTMCP tool surfaces
  - Compare capability snapshots for consistency
  - Identify potential tool poisoning
  - _Requirements: 8.2, 8.3_

- [x] 6.2 Build Governance plugin
  - Check for .cortex governance packs
  - Validate policy compliance and version consistency
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 6.3 Implement Threat Model plugin
  - Apply STRIDE threat modeling to FASTMCP attack vectors
  - Identify prompt injection risks in tool parameters
  - Assess privilege escalation through tool chaining
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 6.4 Create Performance plugin
  - Measure baseline latency for JSON-RPC calls
  - Test timeout handling and circuit breaker behavior
  - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [ ] 6.5 Build Academic Research MCP providers
- [ ] 6.5.1 Create Semantic Scholar MCP provider
  - Implement semantic-scholar.mcp.ts with paper search and citation analysis
  - Add FASTMCP v3.22 compliant tool definitions for academic paper queries
  - _Requirements: 11.1, 11.8_

- [ ] 6.5.2 Build OpenAlex MCP provider  
  - Implement openalex.mcp.ts with scholarly work and author search
  - Add research metrics and institutional affiliation tools
  - _Requirements: 11.2, 11.8_

- [ ] 6.5.3 Create Wikidata MCP provider
  - Implement wikidata.mcp.ts with SPARQL query capabilities
  - Add entity lookup and knowledge graph traversal tools
  - _Requirements: 11.3, 11.8_

- [ ] 6.5.4 Build arXiv MCP provider
  - Implement arxiv.mcp.ts with preprint search and metadata extraction
  - Add category filtering and author lookup capabilities
  - _Requirements: 11.4, 11.8_

- [ ] 6.5.5 Create Vibe Check MCP provider
  - Implement Vibe_Check.mcp.ts for research quality assessment
  - Add academic integrity and methodology validation tools
  - _Requirements: 11.5, 11.8_

- [ ] 6.5.6 Build Context7 MCP provider
  - Implement context7.mcp.ts for contextual research analysis
  - Add cross-reference and citation context tools
  - _Requirements: 11.6, 11.8_

- [ ] 6.5.7 Register academic providers in registry
  - Update registry.providers.academic with all academic MCP providers
  - Ensure proper FASTMCP v3.22 capability registration
  - Add provider discovery and health check endpoints
  - _Requirements: 11.7, 11.8_

- [x] 7. Implement report generation system
- [x] 7.1 Build JSON report generator
  - Create structured JSON output with findings and metadata
  - Include run stamps and execution metadata
  - _Requirements: 4.1, 4.4_

- [x] 7.2 Create Markdown report generator
  - Generate human-readable Markdown reports
  - Include severity prefixes for accessibility
  - Support screen reader friendly output
  - _Requirements: 4.1, 7.1, 7.2, 7.3_

- [x] 7.3 Implement ArcTDD plan generator
  - Create structured remediation plans prioritizing blockers and majors
  - Generate actionable steps for issue resolution
  - _Requirements: 4.2, 4.3_

- [x] 7.4 Build File Plan generator
  - Generate unified diff patches for remediation
  - Create code samples and manual steps
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 8. Create CLI interface and commands
- [x] 8.1 Implement main CLI with Commander.js
  - Build diagnose command with comprehensive options
  - Add doctor command for environment checks
  - Support accessibility options and color controls
  - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.4_

- [x] 8.2 Add compare command for findings diff
  - Implement comparison between diagnostic runs
  - Show added/removed findings with human-readable output
  - _Requirements: 4.1, 4.4_

- [ ] 8.3 Implement SBOM and artifact generation
  - Generate Software Bill of Materials
  - Create CI/CD integration with proper exit codes
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 9. Add observability and monitoring
- [x] 9.1 Implement OpenTelemetry integration
  - Add spans for plugin execution with attributes
  - Include correlation IDs and performance metrics
  - _Requirements: 9.1, 9.4_

- [x] 9.2 Create HAR capture and redaction
  - Implement optional HAR file generation for failed probes
  - Add header redaction for sensitive information
  - _Requirements: 4.4, 4.5_

- [x] 9.3 Build evidence collection system
  - Implement evidence pointer validation and sanitization
  - Add confidence scoring for findings
  - _Requirements: 4.4, 4.5_

- [ ] 10. Create comprehensive test suite
- [ ] 10.1 Build mock FASTMCP servers for testing
  - Create compliant server (ok.ts)
  - Build broken SSE server (broken-sse.ts)
  - Implement bad JSON-RPC server (bad-jsonrpc.ts)
  - Create bad CORS server (bad-cors.ts)
  - _Requirements: All requirements for validation_

- [ ] 10.2 Write unit tests for core components
  - Test plugin host sandboxing and resource limits
  - Validate adapter functionality with mock servers
  - Test report generation with fixture data
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10.3 Create integration tests
  - End-to-end CLI testing with mock FASTMCP servers
  - Multi-plugin execution interference testing
  - Accessibility compliance validation
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10.4 Implement security and performance tests
  - Plugin sandbox escape attempt testing
  - Resource exhaustion and timeout validation
  - Input validation and sanitization testing
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 11. Fix implementation issues and enhance functionality
- [ ] 11.1 Fix TypeScript compilation errors
  - Resolve worker thread type issues in plugin-host.ts (remove unsupported 'type' option)
  - Fix SSE adapter type compatibility in sandbox.ts (align opts parameter types)
  - Update DiagnosticContext interface for proper type safety
  - Add proper type guards for worker message validation
  - _Requirements: All requirements depend on working code_

- [ ] 11.2 Enhance authentication handling
- [ ] 11.2.1 Implement authentication scheme parsing
  - Parse --auth flag format (bearer:token, basic:user:pass, header:name:value)
  - Add authentication context to DiagnosticContext interface
  - Validate authentication scheme formats with proper error messages
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 11.2.2 Add authentication to adapters
  - Inject authentication headers in HTTP adapter based on scheme
  - Update JSON-RPC adapter to include authentication headers
  - Add authentication support to SSE adapter for authenticated endpoints
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 11.3 Improve plugin implementations
- [ ] 11.3.1 Enhance authentication plugin
  - Test multiple authentication schemes (Bearer, Basic, custom headers)
  - Add header case sensitivity testing
  - Implement authentication bypass detection with specific test cases
  - Generate evidence pointers for specific endpoints and response headers
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 11.3.2 Enhance discovery plugin
  - Test prompts/list and resources/list endpoints in addition to tools/list
  - Validate response schemas against MCP specification
  - Add capability negotiation testing with version handshake
  - Include metadata consistency checks across discovery endpoints
  - _Requirements: 1.1, 3.1, 8.1_

- [ ] 11.3.3 Enhance permissioning plugin
  - Implement heuristic pattern matching for tool risk classification
  - Add confidence scoring algorithm for permissioning assessments
  - Generate specific recommendations for confirmation prompts and scoping
  - Test for filesystem, shell, and network access capabilities
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 11.3.4 Enhance streaming SSE plugin
  - Validate MCP-specific SSE message formats and event types
  - Test streaming tool execution progress with proper event parsing
  - Add timeout handling for long-running streaming operations
  - Verify content-type headers and streaming behavior compliance
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 11.3.5 Enhance threat model plugin
  - Implement STRIDE-based assessment for MCP-specific attack vectors
  - Add prompt injection risk detection in tool parameter descriptions
  - Assess privilege escalation through tool chaining scenarios
  - Generate specific threat findings with confidence scores
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11.4 Complete doctor command implementation
- [ ] 11.4.1 Add Node.js environment checks
  - Validate Node.js version compatibility (>=20.0.0)
  - Check for required dependencies and their versions
  - Verify npm/pnpm installation and workspace configuration
  - _Requirements: 5.1, 5.2_

- [ ] 11.4.2 Add network and proxy checks
  - Test DNS resolution and network connectivity
  - Validate proxy configuration and CA certificate store
  - Check for WSL-specific networking issues on Windows
  - Test HTTPS certificate validation and custom CA support
  - _Requirements: 5.1, 5.2_

- [ ] 11.4.3 Add development tool checks
  - Validate Playwright installation and browser dependencies
  - Check for MLX/Ollama availability for ML-based detection
  - Verify OpenTelemetry exporter connectivity when configured
  - Test HAR capture capabilities and redaction functionality
  - _Requirements: 8.1, 9.1, 9.4_

- [ ] 11.5 Implement missing CLI features
- [ ] 11.5.1 Add HAR capture functionality
  - Implement optional HAR file generation for failed probes
  - Add header redaction for sensitive information (authorization, cookie, token)
  - Integrate HAR capture with evidence collection system
  - Support HAR output in report generation
  - _Requirements: 4.4, 4.5_

- [ ] 11.5.2 Implement file-plan generation
  - Enable --file-plan option to generate unified diff patches
  - Create remediation patches for common configuration issues
  - Generate code samples for manual remediation steps
  - Integrate file plans with ArcTDD remediation workflow
  - _Requirements: 4.3, 4.4, 4.5_

- [ ] 11.5.3 Add accessibility mode support
  - Implement --a11y flag for screen reader friendly output
  - Add severity prefixes ([BLOCKER], [MAJOR], [MINOR], [INFO])
  - Support summary-first output mode for cognitive accessibility
  - Ensure WCAG 2.2 AA compliance in CLI output formatting
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11.5.4 Implement SBOM generation
  - Generate Software Bill of Materials using npm ls output
  - Include dependency versions and license information
  - Create CI/CD artifacts for supply chain tracking
  - Add SBOM to report generation pipeline
  - _Requirements: 5.1, 5.2, 5.3, 5.5_
