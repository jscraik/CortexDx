# MCP Tool Definitions

This directory contains comprehensive MCP tool definitions for the CortexDx diagnostic system. All tools follow the MCP protocol specification version 2024-11-05 and provide JSON schema-based input validation.

## Tool Categories

### 1. Diagnostic Tools (`diagnostic-tools.ts`)

**Requirements: 3.1, 5.1, 6.1**

Core diagnostic capabilities for MCP server inspection, validation, and analysis:

- `inspect_mcp_server` - Comprehensive server inspection with protocol compliance, security, and performance checks
- `validate_protocol_compliance` - Protocol specification validation with 99% accuracy
- `scan_security_vulnerabilities` - OWASP-based security scanning with 95% detection accuracy
- `profile_performance` - Millisecond-precision performance profiling
- `check_compatibility` - Cross-client and version compatibility testing
- `analyze_configuration` - Configuration optimization and security review
- `validate_tool_definitions` - Tool definition validation and compliance checking
- `test_transport_protocols` - Transport protocol testing (HTTP, SSE, WebSocket, JSON-RPC)
- `analyze_error_patterns` - Error log analysis and root cause identification
- `generate_diagnostic_report` - Comprehensive diagnostic reporting in multiple formats

### 2. Development Assistance Tools (`development-assistance-tools.ts`)

**Requirements: 1.2, 2.2, 4.1**

AI-powered development assistance for code generation, debugging, and best practices:

- `generate_mcp_server_template` - Customized server template generation (<5s)
- `generate_mcp_connector` - API-to-MCP connector generation (<60s)
- `generate_tool_definitions` - Natural language to tool definition conversion
- `start_interactive_debugging` - Conversational debugging with context analysis (<10s)
- `continue_debugging_session` - Multi-turn debugging conversation
- `interpret_error` - User-friendly error explanations (<5s)
- `suggest_solution_alternatives` - Multiple ranked solution approaches
- `generate_documentation` - Comprehensive documentation generation
- `provide_best_practices` - Best practices recommendations and validation
- `create_interactive_tutorial` - Interactive learning experiences (<15s)
- `refine_generated_code` - Iterative code improvement through feedback
- `explain_mcp_concept` - Adaptive concept explanations

### 3. Academic Integration Tools (`academic-integration-tools.ts`)

**Requirements: 6.2, 10.2, 11.4**

Academic research validation and integration with license compliance:

- `validate_architecture_academic` - Architecture validation against research (Context7)
- `perform_vibe_check` - Comprehensive error checking and anti-pattern detection
- `validate_research_methodology` - Methodology validation with citation checking
- `analyze_research_trends` - Research trend analysis and validation (OpenAlex)
- `validate_knowledge_graph` - Entity and relationship validation (Wikidata)
- `analyze_preprint_research` - arXiv paper analysis with license compliance
- `search_academic_validation` - Advanced search and relevance scoring (Exa)
- `check_citation_compliance` - Citation and attribution validation
- `generate_research_report` - Comprehensive research validation reporting
- `validate_concept_implementation` - Concept correctness validation
- `track_research_provenance` - Research source provenance tracking

### 4. Commercial Feature Tools (`commercial-feature-tools.ts`)

**Requirements: 7.1, 10.5, 12.1**

Enterprise authentication, licensing, and usage tracking:

- `validate_auth0_token` - Auth0 JWT validation with OAuth 2.0/OpenID Connect
- `check_role_access` - Role-based access control (RBAC) validation
- `validate_commercial_license` - License key validation with offline support
- `check_feature_access` - Feature-based licensing validation
- `track_feature_usage` - Usage tracking for billing and analytics
- `get_usage_metrics` - Detailed usage metrics and analytics
- `generate_billing_report` - Usage-based billing reports
- `manage_subscription` - Subscription lifecycle management
- `check_rate_limit` - Rate limit status and quota checking
- `generate_compliance_report` - License compliance and audit reporting
- `configure_sso` - Single Sign-On configuration (SAML, OAuth)
- `manage_api_keys` - API key creation, rotation, and revocation
- `audit_access_logs` - Security and compliance access auditing

### 5. License Validation Tools (`license-validation-tools.ts`)

**Requirements: 13.1, 13.2, 13.4**

Academic research license validation and IP compliance:

- `validate_academic_license` - Academic license validation (<3s)
- `check_license_compatibility` - Multi-license compatibility checking
- `flag_proprietary_content` - Proprietary content identification
- `get_approved_licenses` - Approved license database retrieval
- `track_license_compliance` - Compliance tracking with audit trails
- `generate_compliance_report` - Comprehensive compliance reporting
- `request_license_approval` - Approval workflow initiation
- `check_approval_status` - Approval request status checking
- `validate_implementation_compliance` - Implementation compliance validation
- `assess_ip_risk` - Intellectual property risk assessment
- `maintain_license_database` - License database management
- `generate_attribution_text` - Proper attribution text generation
- `monitor_license_changes` - License change monitoring and alerting

### 6. Development Tools (`development-tools.ts`)

**Legacy tools maintained for backward compatibility**

Basic development tools that are being superseded by the more comprehensive tool categories above.

## Usage

### Importing Tools

```typescript
import { getAllMcpToolsFlat, findMcpTool, getMcpToolsByCategory } from './tools/index.js';

// Get all tools as a flat array
const allTools = getAllMcpToolsFlat();

// Get tools by category
const diagnosticTools = getMcpToolsByCategory('diagnostic');

// Find a specific tool
const tool = findMcpTool('inspect_mcp_server');
```

### Tool Structure

All tools follow the MCP protocol specification:

```typescript
interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}
```

### Server Integration

Tools are automatically registered with the MCP server and exposed via the `tools/list` and `tools/call` JSON-RPC methods:

```typescript
// List all available tools
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

// Call a specific tool
POST /mcp
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "inspect_mcp_server",
    "arguments": {
      "endpoint": "http://localhost:3000"
    }
  }
}
```

## Performance Requirements

Tools are designed to meet specific performance requirements:

- **Diagnostic Tools**: <30s for comprehensive inspection
- **License Validation**: <3s for license checking
- **Error Interpretation**: <5s for user-friendly explanations
- **Template Generation**: <5s for server templates
- **Interactive Debugging**: <10s for session initiation
- **Code Generation**: <60s for connector generation

## Compliance

All tools follow:

- **MCP Protocol**: Version 2024-11-05 specification
- **brAInwav Standards**: Named exports, ≤40 line functions, kebab-case files
- **Security**: No secrets in logs, proper authentication handling
- **Accessibility**: WCAG 2.2 AA compliant outputs
- **Testing**: Comprehensive test coverage with deterministic behavior

## Contributing

When adding new tools:

1. Create tools in the appropriate category file
2. Follow the existing tool structure and naming conventions
3. Include detailed descriptions and input schemas
4. Document performance requirements
5. Add tools to the category export in `index.ts`
6. Update this README with the new tool information
7. Ensure Biome formatting compliance (`pnpm exec biome format --write`)
8. Run tests and build to verify (`pnpm test && pnpm build`)
