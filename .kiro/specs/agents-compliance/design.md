# Design Document

## Overview

This design addresses the systematic resolution of AGENTS.md compliance gaps in the CortexDx MCP project. The solution
is organized into four phases that progressively build upon each other: Phase 1 unblocks development by fixing critical
build and lint issues, Phase 2 enforces quality gates through automated tooling, Phase 3 improves processes and
documentation, and Phase 4 implements advanced compliance features. This phased approach ensures that foundational
issues are resolved before adding enforcement mechanisms, minimizing disruption to ongoing development.

The design prioritizes minimal changes to existing architecture while adding necessary enforcement layers. All changes
maintain backward compatibility with existing workflows and integrate seamlessly with the current toolchain (Mise,
pnpm, Nx, Biome, Vitest).

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     Developer Workflow                       │
├─────────────────────────────────────────────────────────────┤
│  Code → Pre-commit Hooks → Lint → Test → Build → CI        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Quality Enforcement Layer                  │
├─────────────────────────────────────────────────────────────┤
│  • Function Size Enforcer (Biome)                           │
│  • Coverage Reporter (Vitest)                               │
│  • Mutation Tester (Stryker - optional)                     │
│  • Accessibility Validator (Custom)                         │
│  • Determinism Verifier (Test Suite)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      CI/CD Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│  • Build Verification                                        │
│  • Lint Gate (zero warnings)                                │
│  • Test Gate (85% coverage)                                 │
│  • SBOM Generation                                          │
│  • License Scanning                                         │
│  • Severity-based Exit Codes                                │
└─────────────────────────────────────────────────────────────┘
```

### Phase-Based Implementation Strategy

**Phase 1: Unblock Development (Critical)**

- Fix TypeScript build errors
- Resolve Biome lint warnings
- Verify test execution

**Phase 2: Enforce Quality Gates**

- Add function size linting
- Configure coverage reporting
- Implement coverage gates in CI

**Phase 3: Process & Documentation**

- Document ArcTDD workflow
- Add pre-commit hooks
- Create PR templates

**Phase 4: Advanced Compliance**

- Add mutation testing
- Implement SBOM generation
- Add determinism tests
- Implement severity-based exit codes

## Components and Interfaces

### 1. Build System Fixes

**Component:** TypeScript Compiler Configuration

**Purpose:** Resolve type errors in pattern-learning-resolver.ts

**Implementation:**
