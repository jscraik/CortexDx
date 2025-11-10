# Non-Production Code Analysis Report

**Generated:** November 10, 2025  
**Scope:** All files outside of `tests/` directories  
**Repository:** CortexDx (Insula MCP Diagnostic System)  
**Specification Reference:** .kiro/specs/insula-mcp-diagnostic-system/ architectural requirements

## Executive Summary

This report identifies non-production code, development utilities, debugging artifacts, and code quality issues
across the CortexDx codebase with insights from the .kiro architectural specifications. The analysis focuses on files that should be reviewed for production readiness, alignment with FASTMCP v3 plugin architecture, and potential removal/cleanup based on specification requirements.

## Architectural Alignment Analysis

Based on the .kiro specifications, this analysis identifies gaps between current implementation and the FASTMCP v3 architecture:

### Plugin System Compliance

- **Current Status**: Basic diagnostic plugins in `/plugins/` with limited orchestration
- **Required**: Full plugin orchestrator with parallel/sequential execution per MCP tool exposure specs
- **Gap**: Pattern learning system for accumulated diagnostic knowledge not implemented
- **Security**: Plugin sandbox with worker threads exists but needs OWASP ASVS + MITRE ATLAS integration

### LLM Integration Readiness

- **Current Status**: Basic LLM adapter interface in place
- **Required**: Ollama/MLX backends with conversational capabilities and <2s response times
- **Gap**: Enhanced LLM adapter for natural language development assistance missing
- **Feature**: Local-first processing and conversation context management not implemented

### Academic Provider Integration

- **Current Status**: Placeholder academic providers in `/src/providers/academic/`
- **Required**: Context7, Vibe Check, Semantic Scholar, OpenAlex, Wikidata, arXiv, Exa integrations
- **Gap**: License validation system for research compliance not implemented
- **Compliance**: Intellectual property checking per specification requirements missing

### Authentication & Commercial Features

- **Current Status**: Basic auth plugin structure
- **Required**: OAuth2/Auth0 authenticator with device code flow for CLI
- **Gap**: Credential manager for secure token storage missing
- **Commercial**: Tiered licensing system (Community/Professional/Enterprise) not implemented

### Security Framework Integration

- **Current Status**: Basic security scanning capabilities
- **Required**: OWASP ASVS + MITRE ATLAS combined assessment framework
- **Gap**: Semgrep, gitleaks, OWASP ZAP integration missing
- **AI Security**: ATLAS threat detection for prompt injection, data poisoning not implemented

## 1. Development & Debugging Scripts

### 1.1 Mock Servers & Testing Utilities

**Location:** `packages/insula-mcp/scripts/mock-servers/`

- **`ok.ts`** - Simple HTTP mock server for testing (port 8088)
- **`bad-cors.ts`** - CORS error simulation server
- **`bad-jsonrpc.ts`** - JSON-RPC error simulation server
- **`broken-sse.ts`** - Server-Sent Events error simulation server

**Recommendation:** These are legitimate testing infrastructure. Keep but ensure they're not deployed to production.

### 1.2 Research & Development Scripts

**Location:** `packages/insula-mcp/`

- **`research-improvements.js`** - Academic research script for debugging improvements (216 lines)
  - Uses academic providers to research interactive debugging approaches
  - Contains hardcoded mock responses
  - **Issue:** Shebang `#!/usr/bin/env node` but incomplete implementation
- **`simple-server.js`** - Empty file (0 lines)
  - **Issue:** Dead file that should be removed

**Recommendation:** Remove `simple-server.js`, review if `research-improvements.js` should be moved to
scripts/ or documented as experimental.

### 1.3 Internal Development Tools

**Location:** `packages/insula-mcp/scripts/internal/`

- **`self-improvement.ts`** - Internal development tool (174 lines)
  - Automated code improvement system
  - Integrates with history and project context
  - Used via npm script: `internal:self-improvement`

**Recommendation:** Legitimate development tooling, keep but ensure proper documentation.

## 2. Build & Deployment Infrastructure

### 2.1 Docker Configuration

**Location:** `packages/insula-mcp/`

- **`Dockerfile`** - Production Dockerfile (97 lines)
- **`Dockerfile.community`** - Community edition variant
- **`Dockerfile.professional`** - Professional edition variant
- **`Dockerfile.enterprise`** - Enterprise edition variant
- **`docker-compose.yml`** - Multi-tier deployment (176 lines)

**Recommendation:** Production infrastructure, keep all.

### 2.2 Deployment Scripts

**Location:** `packages/insula-mcp/scripts/`

- **`build-docker-images.sh`** - Docker image builder (90 lines)
- **`quick-deploy.sh`** - Rapid deployment utility (205 lines)
- **`publish-npm.sh`** - NPM publishing automation (93 lines)
- **`backup.sh`** - Data backup automation (141 lines)
- **`restore.sh`** - Data restoration utility (170 lines)

**Recommendation:** Production deployment infrastructure, keep all.

## 3. IDE Extensions & Development Tools

### 3.1 Visual Studio Code Extension

**Location:** `packages/insula-mcp/ide-extensions/vscode/`

- **`package.json`** - VS Code extension manifest (161 lines)
- **`src/`** - Extension source code

### 3.2 IntelliJ Plugin

**Location:** `packages/insula-mcp/ide-extensions/intellij/`

- **`plugin.xml`** - IntelliJ plugin configuration

**Recommendation:** Legitimate IDE integration tools, keep all.

## 4. Documentation & Maintenance Utilities

### 4.1 Root-Level Scripts

**Location:** `/scripts/`

- **`broken-link-monitor.js`** - Link health monitoring (518 lines)
- **`docs-maintenance.js`** - Documentation maintenance automation (481 lines)
- **`sync-versions.js`** - Version synchronization across docs (307 lines)
- **`validate-docs.js`** - Documentation validation (301 lines)

**Recommendation:** Development maintenance tools, keep but consider moving to `packages/insula-mcp/scripts/` for
consistency.

### 4.2 Validation & Quality Tools

**Location:** `packages/insula-mcp/scripts/`

- **`validate-schemas.ts`** - Schema validation utility (87 lines)
- **`accessibility/story-card.ts`** - A11y testing with Playwright/Axe (57 lines)

**Recommendation:** Quality assurance tools, keep all.

## 5. Generated Artifacts & Reports

### 5.1 JSON Reports (Likely Generated)

**Files identified:**

- `fixed-inspector-report.json`
- `working-inspector-report.json`
- `server-running-report.json`
- `studio-wrapper-test.json`
- `cortex-test-report.json`
- `docs-maintenance-report.json`
- `docs-validation-report.json`

**Recommendation:** Add to `.gitignore` if these are generated artifacts.

### 5.2 Log Files

**Files identified:**

- `packages/insula-mcp/server.log`

**Recommendation:** Add `*.log` to `.gitignore`.

## 6. Code Quality Issues

### 6.1 TODO/FIXME Comments

**Found 20+ instances in production code:**

**High Priority:**

- `src/security/semgrep-integration.ts:79` - "TODO: Implement actual Semgrep execution"
- `src/security/zap-integration.ts:61` - "TODO: Implement actual ZAP API calls"
- `src/security/gitleaks-integration.ts:57` - "TODO: Implement actual gitleaks execution"

**Medium Priority:**

- `src/commands/interactive-cli.ts:169` - "TODO: Integrate with LLM orchestrator"
- `src/commands/interactive-cli.ts:290` - "TODO: Implement actual template generation logic"

**Recommendation:** Create GitHub issues for all TODOs and implement or remove incomplete features.

### 6.2 Debug Console Output

**Found 50+ console.log/error statements in production code:**

**Examples:**

- `src/server.ts:1200-1226` - Extensive startup logging (27 lines of console output)
- `src/conversation/manager.ts:35,38` - Session restoration logging
- `src/commands/health.ts:multiple` - Health check output

**Recommendation:**

1. Replace with proper logging framework (already using `pino`)
2. Remove debug console statements
3. Ensure production logging is configurable

### 6.3 Demo/Mock Data in Production Code

**Found in `src/server.ts:61-92`:**

```typescript
// Initialize demo licenses
licenseDatabase.set("community-demo-key", { ... });
licenseDatabase.set("professional-demo-key", { ... });
licenseDatabase.set("enterprise-demo-key", { ... });
```

**Recommendation:** Move demo data to development configuration or mark clearly as development-only.

## 7. Incomplete Features

### 7.1 Interactive CLI Placeholders

**Location:** `src/commands/interactive-cli.ts`

Multiple features marked as "not yet fully implemented":

- Template generation (line 293)
- Connector generation (line 356)
- Interactive debugging (line 440)
- Error interpretation (line 505)
- Documentation generation (line 571)
- Best practices analysis (line 648)
- Tutorial creation (line 707)
- Concept explanation (line 771)

**Recommendation:** Complete implementations.

## 8. Configuration & Infrastructure

### 8.1 Pattern Storage Example

**Location:** `src/storage/pattern-storage-example.ts`

- Example implementation (229 lines)
- Demonstrates usage patterns
- Contains "/tmp/" file paths

**Recommendation:** Move to documentation or examples directory.

### 8.2 Web Interface Assets

**Location:** `src/web/app.js`

- Client-side JavaScript (321 lines)
- Production web interface code

**Recommendation:** Keep, but ensure it's properly bundled for production.

## 9. Service Configuration Files

### 9.1 System Service Files

**Location:** Root directory

- **`com.brainwav.cortexdx.plist`** - macOS launchd configuration
- **`install-service.sh`** - Service installation script
- **`uninstall-service.sh`** - Service removal script
- **`manage-service.sh`** - Service management utility

**Recommendation:** Production deployment tools, keep all.

## Priority Action Items

### High Priority (Production Blockers)

1. **Remove empty `simple-server.js`**
2. **Implement or remove security TODOs** (Semgrep, ZAP, gitleaks)
3. **Replace console.* with proper logging** in production paths
4. **Move or clearly mark demo license data**
5. **Execute systematic "insula" to "cortexdx" renaming**

### Medium Priority (Code Quality)

1. **Create GitHub issues for all TODO comments**
2. **Add generated files to `.gitignore`**
3. **Complete or remove incomplete CLI features**
4. **Move example files to proper directories**

### Low Priority (Organization)

1. **Consolidate script locations** (consider moving root `/scripts/` to package)
2. **Document development vs production file boundaries**
3. **Add development setup documentation**

## 10. Branding & Naming Consistency Issues

### 10.1 Legacy "Insula" References

The codebase contains extensive references to the legacy "insula" branding that should be updated to "cortexdx"
for consistency with the current project name.

**Critical Files Requiring Renaming:**

**Package Structure:**

- `packages/insula-mcp/` → `packages/cortexdx/`
- Package name in `package.json`: `@brainwav/insula-mcp` → `@brainwav/cortexdx`

**Documentation & Configs:**

- All references to `insula-mcp` in documentation files
- GitHub workflow names (`insula-mcp.yml`)
- Docker image names and environment variables (`INSULA_*`)
- IDE extension names (`insula-mcp-vscode`)

**Source Code References:**

- Service labels: `com.brainwav.insula-local-memory` → `com.brainwav.cortexdx-*`
- Environment variables: `INSULA_*` → `CORTEXDX_*`
- File paths in scripts and configurations
- NPM package references and badges

**Examples of Required Changes:**

```bash
# Directory structure
mv packages/insula-mcp packages/cortexdx

# Package.json updates
"@brainwav/insula-mcp" → "@brainwav/cortexdx"
```

## 11. Architectural Specification Compliance

Based on the .kiro specifications analysis, the following architectural gaps must be addressed to align with FASTMCP v3
requirements:

### 11.1 Plugin Architecture Enhancement

**Current State**: Basic diagnostic plugin system with limited orchestration  
**Required**: Full FASTMCP v3 plugin architecture with orchestration

**Missing Components:**

- Plugin orchestrator for parallel/sequential execution
- MCP tool exposure for diagnostic plugins  
- Pattern learning system for accumulated knowledge
- Enhanced plugin interfaces for conversational assistance

**Implementation Priority**: High - Core architectural requirement

### 11.2 LLM Integration System

**Current State**: Basic LLM adapter interface  
**Required**: Local LLM backends with conversational capabilities

**Missing Components:**

- Ollama/MLX backend adapters
- Conversation context management
- Model selection strategy (Code/Chat/Debug/Documentation)
- Performance optimization (<2s response times)
- Natural language to MCP server generation

**Implementation Priority**: High - Key differentiator for user experience

### 11.3 Security Framework Integration

**Current State**: Basic security scanning  
**Required**: OWASP ASVS + MITRE ATLAS combined framework

**Missing Components:**

- ASVS compliance engine with tiered verification (L1/L2/L3)
- ATLAS threat detection for AI/ML-specific attacks
- Integration with Semgrep, gitleaks, OWASP ZAP
- Prompt injection safeguards
- Data poisoning detection for pattern learning

**Implementation Priority**: High - Security-first requirement

### 11.4 Academic Provider System

**Current State**: Placeholder academic provider structure  
**Required**: Full academic research integration with license compliance

**Missing Components:**

- Context7, Vibe Check, Semantic Scholar integrations
- OpenAlex, Wikidata, arXiv, Exa provider implementations
- License validation system with real-time checking
- Intellectual property compliance tracking
- Research-based improvement suggestions

**Implementation Priority**: Medium - Commercial differentiator

### 11.5 Authentication & Commercial Infrastructure

**Current State**: Basic authentication plugin  
**Required**: OAuth2/Auth0 with commercial licensing tiers

**Missing Components:**

- OAuth authenticator with device code flow
- Credential manager for secure token storage
- Auth0 integration plugin
- Tiered licensing system (Community/Professional/Enterprise)
- Usage tracking and feature access control

**Implementation Priority**: Medium - Required for commercial deployment

### 11.6 Advanced Features

**Current State**: Core diagnostic functionality  
**Required**: Enhanced capabilities per specification

**Missing Components:**

- Report manager with URL-based sharing
- LangGraph v1.0 integration for workflow orchestration
- Dependency scanner with SBOM generation
- Performance profiler integration (Clinic.js, py-spy)
- Protocol validator with Protovalidate

**Implementation Priority**: Low - Nice-to-have enhancements

### 11.7 Recommended Implementation Sequence

1. **Phase 1 (Q1)**: Plugin orchestration and LLM backend integration
2. **Phase 2 (Q2)**: Security framework and authentication systems
3. **Phase 3 (Q3)**: Academic providers and license validation
4. **Phase 4 (Q4)**: Advanced features and commercial infrastructure

This implementation roadmap ensures core functionality is established before adding commercial and advanced features.

---

**End of Report**

Generated by CortexDx Non-Production Code Analyzer  
For questions or clarifications, refer to AGENTS.md and .kiro/specs/ documentation.

# Environment variables

INSULA_LICENSE_KEY → CORTEXDX_LICENSE_KEY
INSULA_MCP_TIER → CORTEXDX_TIER

# File references

packages/insula-mcp/src → packages/cortexdx/src

```

**Recommendation:** Create a systematic renaming plan with the following phases:

1. **Phase 1:** Update package directory and package.json
2. **Phase 2:** Update all file paths in scripts and configurations
3. **Phase 3:** Update documentation and README files
4. **Phase 4:** Update environment variables and service names
5. **Phase 5:** Update external references (badges, workflows)

**Tools to Assist:**

- Use `find` and `sed` scripts for bulk replacements
- Update all GitHub Actions workflows
- Verify Docker builds after renaming
- Update any external documentation links

This renaming effort will improve brand consistency and reduce confusion between legacy and current naming
conventions throughout the codebase.

## Summary

The codebase contains a significant amount of legitimate development infrastructure (deployment scripts,
IDE extensions, build tools) alongside some items requiring cleanup (empty files, TODOs, debug output).
The main concerns include incomplete security features, extensive debug logging in production code paths,
widespread legacy "insula" branding that needs systematic renaming, and significant architectural gaps
compared to the FASTMCP v3 specification requirements.

**Key Findings:**

**Total Non-Production Files Identified:** 45+  
**Critical Issues:** 9 (including branding consistency)  
**Code Quality Issues:** 50+ console statements, 20+ TODOs, 100+ "insula" references  
**Legitimate Dev Infrastructure:** 35+ files (Docker, scripts, IDE tools)  
**Architectural Gaps:** 6 major areas requiring specification compliance  
**Implementation Priority:** High for plugin orchestration, LLM integration, and security framework

**Recommended Actions:**

1. **Immediate (High Priority):** Implement plugin orchestration and LLM backend integration per FASTMCP v3
2. **Short-term:** Complete security framework integration (OWASP ASVS + MITRE ATLAS)
3. **Medium-term:** Systematic "insula" to "cortexdx" branding update across all assets
4. **Long-term:** Academic provider integration and commercial infrastructure deployment

The architectural compliance analysis reveals that while the core diagnostic infrastructure is solid, 
significant enhancements are needed to meet the full FASTMCP v3 specification and deliver the advanced
conversational assistance, security framework integration, and academic validation capabilities outlined
in the .kiro documentation.
