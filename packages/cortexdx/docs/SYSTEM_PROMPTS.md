# System Prompts Reference

**Version**: 2.0
**Last Updated**: 2025-11-12

This document provides a comprehensive reference for all system prompts used in CortexDx's LLM (Large Language Model) integrations. All prompts enforce deterministic JSON output schemas and include explicit tool awareness sections.

📖 **[View Glossary](GLOSSARY.md)** for definitions of abbreviations and technical terms.

---

## Table of Contents

- [Overview](#overview) - System prompt architecture
- [Core Prompts](#core-prompts) - Foundational system prompts
- [Specialized Analysis Prompts](#specialized-analysis-prompts) - Domain-specific prompts
- [Plugin Prompts](#plugin-prompts) - Plugin-specific system prompts
- [Prompt Templates](#prompt-templates) - Reusable prompt templates
- [Design Principles](#design-principles) - Common patterns and rules
- [Testing & Validation](#testing--validation) - How to test prompts

---

## Overview

CortexDx uses **12 system prompts** across 9 files to guide LLM behavior for diagnostics, code analysis, and problem resolution. All prompts follow these core principles:

- **Determinism**: Same input produces same output structure
- **Tool Awareness**: Reference available CortexDx plugins and tools
- **Explicit Schemas**: JSON output schemas prevent ambiguous responses
- **Security First**: Security findings prioritized, unsafe actions forbidden

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   LLM Orchestrator                   │
│              (ml/orchestrator.ts)                    │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        v           v           v
┌─────────────┐ ┌─────────┐ ┌─────────────┐
│   Adapters   │ │ Plugins │ │  Templates  │
│ (ollama.ts)  │ │         │ │             │
└─────────────┘ └─────────┘ └─────────────┘
```

---

## Core Prompts

### 1. DEFAULT_SYSTEM_PROMPT

**Location**: `src/ml/conversational-adapter.ts:14`

**Purpose**: Default prompt for CortexDx's embedded MCP (Model Context Protocol) assistant.

**Key Features**:
- Response structure: Summary → Details → Next Steps
- Tool awareness: diagnostic plugins, code analysis, solution generation
- Constraints: 3 paragraphs max, prefer code examples, include validation steps

**Output Format**:
```markdown
1. **Summary** (1-2 sentences)
2. **Details** (bullet points)
3. **Next Steps** (actionable items with file references)
```

---

### 2. Safety & Remediation Prompt

**Location**: `src/self-healing/ollama-reasoner.ts:88`

**Purpose**: Internal safety and remediation analysis for findings.

**Key Features**:
- Exact output structure with Health Summary, Priority Actions, Tool Recommendations
- Severity ordering: critical > major > minor
- Behavioral rules: reference finding IDs, use imperative verbs

**Output Format**:
```markdown
### Health Summary
[1-2 paragraphs describing system state]

### Priority Actions
1. [CRITICAL] Finding-001: Specific action
2. [MAJOR] Finding-002: Specific action

### Tool Recommendations
- Run `security-scanner` for vulnerability analysis
- Run `compliance-check` for regulatory concerns
```

---

### 3. Session-Specific System Messages

**Location**: `src/adapters/ollama.ts:545`

**Purpose**: Context-aware prompts for different conversation types.

**Session Types**:

| Type | Focus | Suggested Tools |
|------|-------|-----------------|
| **development** | Build MCP servers/connectors | code-generation, api-code-generator, template-generator |
| **debugging** | Diagnose and fix issues | protocol, security-scanner, mcp-compatibility |
| **learning** | Explain MCP concepts | mcp-docs, discovery, protocol |

**Development Mode Workflow**:
1. Understand goal and constraints
2. Suggest patterns from MCP best practices
3. Provide code examples with inline comments
4. Recommend validation steps

**Debugging Mode Decision Rules**:
- Clear error message → provide solution directly
- Ambiguous error → ask ONE clarifying question
- Always suggest relevant diagnostic tools

---

## Specialized Analysis Prompts

### 4. Code Analysis Prompt

**Location**: `src/adapters/ollama.ts:306`

**Purpose**: Analyze code for MCP compliance and quality.

**Output Schema**:
```json
{
  "issues": [{"severity": "error|warning|info", "line": 0, "message": "", "fix": ""}],
  "suggestions": [""],
  "metrics": {"complexity": 0.0, "maintainability": 0.0, "testability": 0.0, "performance": 0.0},
  "confidence": 0.0,
  "recommendedTools": ["plugin names"]
}
```

**Metrics Scale**: 0.0 to 1.0 (normalized)

---

### 5. Solution Generation Prompt

**Location**: `src/adapters/ollama.ts:379`

**Purpose**: Generate solutions for MCP problems with quality criteria.

**Quality Criteria**:
1. **Specificity**: Reference exact files, lines, configs
2. **Safety**: Include rollback steps for destructive actions
3. **Testability**: Every solution has validation steps
4. **Minimalism**: Smallest change that fixes the issue

**Output Schema**:
```json
{
  "id": "solution-uuid",
  "type": "automated|manual|hybrid",
  "confidence": 0.0,
  "steps": [{"order": 1, "action": "", "command": "", "expectedOutcome": ""}],
  "codeChanges": [{"file": "", "line": 0, "before": "", "after": ""}],
  "rollbackPlan": {"steps": [], "riskLevel": "low|medium|high"},
  "recommendedTools": []
}
```

---

### 6. Error Explanation Prompt

**Location**: `src/adapters/ollama.ts:479`

**Purpose**: Explain MCP errors with audience adaptation.

**Audience Adaptation**:
- **User-friendly**: No jargon, use analogies
- **Technical**: Reference MCP protocol, debugging steps

**Output Schema**:
```json
{
  "summary": "1-2 sentence overview",
  "userFriendlyExplanation": "",
  "technicalDetails": "",
  "rootCause": "",
  "nextSteps": [{"step": 1, "action": "", "command": ""}],
  "prevention": "",
  "recommendedTools": []
}
```

---

## Plugin Prompts

### 7. LLM_SYSTEM_PROMPT (Meta-Mentor)

**Location**: `src/plugins/development/self-improvement.ts:30`

**Purpose**: Feedback provider for AI agents with dynamic tone adaptation.

**Tone Adaptation Rules**:
- **Gentle & validating**: Agent making progress
- **Curious & question-heavy**: Unclear assumptions
- **Sharp & direct**: Clear risks or loops
- **Stern & straightforward**: Stuck in unhelpful pattern

**Tool Awareness**:
- Diagnostics: protocol, security-scanner, mcp-compatibility, discovery
- Development: code-generation, problem-resolver, template-generator
- Analysis: performance-analysis, compliance-check, threat-model
- Research: Context7, Exa, OpenAlex

**Determinism Rules**:
- Same input → same analysis structure
- `suggested_next_moves` ordered by impact
- Consistent categorization for repeated patterns

**Output Schema**:
```json
{
  "quick_read": "1-3 sentence summary",
  "what_i_notice": ["patterns/risks/strengths"],
  "suggested_next_moves": ["concrete next steps"]
}
```

---

### 8. SECURITY_SCANNER_PROMPT

**Location**: `src/plugins/security-scanner.ts:26`

**Purpose**: Security analysis with OWASP/CWE mapping.

**Classification Rules**:
- **CRITICAL**: RCE, auth bypass, data exfiltration, privilege escalation
- **HIGH**: SQLi, XSS, SSRF, insecure deserialization
- **MEDIUM**: CSRF, information disclosure, weak crypto
- **LOW**: Verbose errors, deprecated functions

**Output Schema**:
```json
{
  "findings": [{
    "id": "VULN-001",
    "severity": "critical|high|medium|low",
    "owasp": "A01:2021-Broken Access Control",
    "cwe": "CWE-79",
    "location": {"file": "", "line": 0},
    "remediation": "",
    "codefix": ""
  }],
  "priorityOrder": ["finding IDs in fix order"],
  "complianceImpact": {"asvs": [], "owasp": [], "cwe": []}
}
```

**Tool Chain**: threat-model → compliance-check → asvs-compliance

---

### 9. PROBLEM_RESOLVER_PROMPT

**Location**: `src/plugins/development/problem-resolver.ts:111`

**Purpose**: Automated fix generation with safety mechanisms.

**Fix Strategy Selection**:
- **quick-patch**: Isolated issue
- **refactor**: Design flaw
- **config-change**: Misconfiguration
- **dependency-update**: Version issue
- **architecture-change**: Fundamental issue

**Required Sections**:
- Security impact assessment
- Rollback mechanism with state snapshots
- Confidence score (auto-fix if > 0.8, manual review if < 0.6)

---

### 10. DISCOVERY_ANALYSIS_PROMPT

**Location**: `src/plugins/discovery.ts:7`

**Purpose**: MCP server capability validation and compliance scoring.

**Discovery Workflow**:
1. Enumerate tools, prompts, resources
2. Validate schema compliance
3. Check for missing required fields
4. Assess tool descriptions
5. Identify integration issues

**Output Schema**:
```json
{
  "serverInfo": {"name": "", "version": "", "protocolVersion": ""},
  "tools": [{"name": "", "compliance": "full|partial|missing"}],
  "healthStatus": "healthy|degraded|unhealthy",
  "complianceScore": 0.0,
  "securityConcerns": []
}
```

---

### 11. PERFORMANCE_ANALYSIS_PROMPT

**Location**: `src/plugins/development/performance-analysis.ts:20`

**Purpose**: Performance metrics analysis with optimization recommendations.

**Thresholds**:
- **Good**: p95 < 100ms, memory < 512MB, CPU < 50%
- **Acceptable**: p95 < 500ms, memory < 1GB, CPU < 75%
- **Poor**: p95 > 500ms, memory > 1GB, CPU > 75%

**Output Schema**:
```json
{
  "metrics": {
    "responseTime": {"p50": 0, "p95": 0, "p99": 0},
    "memory": {"heapMB": 0, "rssMB": 0}
  },
  "status": "good|acceptable|poor",
  "bottlenecks": [{"component": "", "severity": "", "impact": ""}],
  "optimizations": [{"target": "", "impact": "", "effort": ""}],
  "recommendedTools": ["flamegraph", "pyspy", "performance-testing"]
}
```

---

## Prompt Templates

**Location**: `src/ml/orchestrator.ts:464`

### error-explanation

**Variables**: `{{userLevel}}`, `{{error}}`, `{{severity}}`, `{{context}}`

**User Level Adaptations**:
- **Beginners**: Analogies, copy-paste solutions
- **Intermediate**: Protocol references, debugging tools
- **Experts**: Concise, technical, optimization opportunities

### solution-generation

**Variables**: `{{problem}}`, `{{userLevel}}`, `{{constraints}}`

**Quality Criteria**: Specificity, Safety, Testability, Minimalism

### code-review

**Variables**: `{{language}}`, `{{code}}`

**Review Criteria**:
1. MCP Protocol Compliance
2. Security Issues (OWASP Top 10)
3. Performance Concerns
4. Best Practices
5. Error Handling

---

## Design Principles

### Determinism Patterns

All prompts enforce these patterns for consistent output:

```typescript
// Required in every prompt
"Respond with ONLY valid JSON matching this schema."

// Priority ordering
"[Numbered list, ordered by severity: critical > major > minor]"

// No randomness
"Never introduce randomness in ordering - prioritize by impact"
```

### Tool Awareness Template

Every prompt should include:

```markdown
## Tool Recommendations
When suggesting next moves, reference specific CortexDx tools:
- For X issue → use Y plugin
- Always validate with Z
```

### Security-First Rules

```markdown
## Behavioral Rules
- Security findings prioritized over performance issues
- Never recommend disabling security features
- Include rollback for destructive actions
- Require security impact assessment for all fixes
```

---

## Testing & Validation

> **Note:** Automated prompt tests for determinism, schema validation, and tool coverage are not yet implemented as workspace scripts.
> Manual validation is recommended: run prompt inputs multiple times, check output structure against JSON schemas, and verify tool recommendations.
### Performance Targets

- Code analysis: < 5 seconds
- Solution generation: < 10 seconds
- Error explanation: < 3 seconds
- Full diagnostic: < 30 seconds

---

## Related Documentation

- [SELF_IMPROVEMENT_PLUGIN.md](SELF_IMPROVEMENT_PLUGIN.md) - Self-improvement diagnostics
- [API_REFERENCE.md](API_REFERENCE.md) - API documentation
- [SECURITY.md](../../SECURITY.md) - Security policy
- [GLOSSARY.md](GLOSSARY.md) - Term definitions

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-18 | Enhanced all prompts with determinism and tool awareness | Claude |
| 2025-11-18 | Added SECURITY_SCANNER_PROMPT, PROBLEM_RESOLVER_PROMPT, DISCOVERY_ANALYSIS_PROMPT, PERFORMANCE_ANALYSIS_PROMPT | Claude |
| 2025-11-18 | Initial system prompts reference documentation | Claude |

---

*This document is maintained alongside the system prompt implementations.*
*Review cycle: On every prompt modification*
