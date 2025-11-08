# Requirements Document

## Introduction

This specification addresses the compliance gaps identified in the AGENTS.md compliance review for the Insula MCP
project. The system currently has a C+ (70%) compliance rating with critical blocking issues in build stability and
code quality enforcement. This feature will systematically resolve all identified gaps to achieve full AGENTS.md
compliance, focusing first on unblocking development, then enforcing quality gates, improving processes and
documentation, and finally implementing advanced compliance features.

## Glossary

- **Build System**: The TypeScript compilation and bundling infrastructure using tsup
- **Lint System**: The Biome-based code quality and formatting enforcement system
- **Test Runner**: The Vitest-based unit testing framework
- **CI Pipeline**: The GitHub Actions continuous integration workflow
- **ArcTDD**: Architecture-driven Test-Driven Development methodology (Red → Green → Refactor, ≤7 steps per arc)
- **Coverage Reporter**: The system that measures and reports test coverage percentages
- **Function Size Enforcer**: A linting rule that limits function length to ≤40 lines
- **Determinism Mode**: A CLI flag that ensures reproducible diagnostic outputs
- **Evidence Pointer**: A reference in diagnostic findings to source code, logs, or URLs
- **Accessibility Validator**: A system that ensures WCAG 2.2 AA compliance for CLI outputs
- **Mutation Tester**: A testing tool that verifies test suite quality by introducing code mutations
- **SBOM Generator**: A system that produces Software Bill of Materials for dependency tracking
- **Severity Exit Code**: Process exit codes that indicate diagnostic severity (blocker=1, major=2)

## Requirements

### Requirement 1

**User Story:** As a developer, I want the TypeScript build to complete successfully, so that I can run tests and verify
functionality

#### Acceptance Criteria

1. WHEN the developer executes `pnpm build`, THE Build System SHALL compile all TypeScript files without type errors
2. THE Build System SHALL resolve type mismatches in pattern-learning-resolver.ts for Evidence, ProblemType, Severity,
   and ProjectContext
3. WHEN the build completes, THE Build System SHALL produce valid JavaScript bundles and type declaration files
4. THE Build System SHALL exit with code 0 when compilation succeeds
5. WHEN the developer executes `pnpm test` after a successful build, THE Test Runner SHALL execute all test suites

### Requirement 2

**User Story:** As a developer, I want all lint warnings resolved, so that the codebase meets zero-warning quality standards

#### Acceptance Criteria

1. WHEN the developer executes `pnpm lint`, THE Lint System SHALL complete with zero warnings
2. THE Lint System SHALL report no noParameterAssign violations in oauth-authenticator.ts
3. THE Lint System SHALL report no noNonNullAssertion violations in inspector-adapter.ts
4. THE Lint System SHALL report no noExplicitAny violations in inspector-adapter.ts
5. WHEN lint passes, THE Lint System SHALL exit with code 0

### Requirement 3

**User Story:** As a developer, I want function size limits enforced automatically, so that code remains maintainable
and compliant with the 40-line limit

#### Acceptance Criteria

1. THE Lint System SHALL enforce a maximum function length of 40 lines
2. WHEN a function exceeds 40 lines, THE Lint System SHALL report a lint error with the function name and line count
3. THE Lint System SHALL apply the function size rule to all TypeScript files in src directory
4. THE Lint System SHALL exclude test files from the 40-line function limit
5. WHEN the developer executes `pnpm lint`, THE Lint System SHALL validate function sizes before other rules

### Requirement 4

**User Story:** As a developer, I want test coverage reporting configured, so that I can verify the codebase meets the
85% coverage requirement

#### Acceptance Criteria

1. WHEN the developer executes `pnpm test`, THE Test Runner SHALL generate coverage reports for all source files
2. THE Coverage Reporter SHALL measure line coverage, branch coverage, function coverage, and statement coverage
3. THE Coverage Reporter SHALL produce coverage reports in text, HTML, and JSON formats
4. THE Coverage Reporter SHALL exclude test files, mock servers, and build artifacts from coverage calculations
5. WHEN coverage falls below 85%, THE Coverage Reporter SHALL display a warning message with current coverage percentage

### Requirement 5

**User Story:** As a developer, I want coverage gates in CI, so that pull requests cannot merge without meeting
coverage requirements

#### Acceptance Criteria

1. WHEN the CI Pipeline executes tests, THE CI Pipeline SHALL fail if line coverage is below 85%
2. THE CI Pipeline SHALL display coverage percentages in the workflow summary
3. THE CI Pipeline SHALL upload coverage reports as workflow artifacts
4. THE CI Pipeline SHALL comment on pull requests with coverage changes
5. WHERE coverage decreases by more than 2%, THE CI Pipeline SHALL mark the check as failed

### Requirement 6

**User Story:** As a developer, I want ArcTDD workflow documentation, so that I can follow test-first development practices

#### Acceptance Criteria

1. THE Documentation System SHALL provide a CONTRIBUTING.md file in the repository root
2. THE Documentation System SHALL explain the ArcTDD methodology with Red-Green-Refactor cycle
3. THE Documentation System SHALL provide examples of breaking work into ≤7 steps per arc
4. THE Documentation System SHALL include templates for writing tests before implementation
5. THE Documentation System SHALL reference the ArcTDD requirements from AGENTS.md

### Requirement 7

**User Story:** As a developer, I want pre-commit hooks for test-first enforcement, so that I cannot commit code
without corresponding tests

#### Acceptance Criteria

1. WHEN the developer attempts to commit code changes, THE Pre-commit Hook System SHALL execute lint checks before
   allowing the commit
2. WHEN the developer attempts to commit code changes, THE Pre-commit Hook System SHALL execute relevant tests before
   allowing the commit
3. THE Pre-commit Hook System SHALL prevent commits if lint checks fail
4. THE Pre-commit Hook System SHALL prevent commits if tests fail
5. THE Pre-commit Hook System SHALL complete pre-commit checks within 30 seconds for typical changes

### Requirement 8

**User Story:** As a developer, I want determinism tests, so that I can verify the --deterministic flag produces
reproducible outputs

#### Acceptance Criteria

1. THE Test Runner SHALL include test cases that verify deterministic mode behavior
2. WHEN tests execute with --deterministic flag, THE Test Runner SHALL verify that repeated runs produce identical outputs
3. THE Test Runner SHALL verify that timestamps are handled consistently in deterministic mode
4. THE Test Runner SHALL verify that random seeds are fixed in deterministic mode
5. THE Test Runner SHALL verify that Evidence Pointers are included in all diagnostic findings

### Requirement 9

**User Story:** As a developer, I want accessibility tests for CLI output, so that I can verify WCAG 2.2 AA compliance

#### Acceptance Criteria

1. THE Test Runner SHALL include test cases that verify severity prefixes are present in all outputs
2. THE Test Runner SHALL verify that --no-color flag removes all color codes from output
3. THE Test Runner SHALL verify that outputs begin with summary text suitable for screen readers
4. THE Test Runner SHALL verify that no information is conveyed by color alone
5. THE Accessibility Validator SHALL document screen reader testing procedures in CONTRIBUTING.md

### Requirement 10

**User Story:** As a developer, I want severity-based exit codes implemented, so that CI can distinguish between
blocker and major findings

#### Acceptance Criteria

1. WHEN diagnostics include blocker severity findings, THE CLI System SHALL exit with code 1
2. WHEN diagnostics include major severity findings but no blockers, THE CLI System SHALL exit with code 2
3. WHEN diagnostics include only minor or info findings, THE CLI System SHALL exit with code 0
4. THE CLI System SHALL document exit codes in the --help output
5. THE CI Pipeline SHALL use exit codes to determine workflow success or failure

### Requirement 11

**User Story:** As a developer, I want mutation testing configured, so that I can verify test suite quality meets the
70% mutation kill threshold

#### Acceptance Criteria

1. WHERE mutation testing is enabled, THE Mutation Tester SHALL introduce code mutations to source files
2. WHERE mutation testing is enabled, THE Mutation Tester SHALL execute the test suite against each mutation
3. WHERE mutation testing is enabled, THE Mutation Tester SHALL calculate the percentage of killed mutations
4. WHERE mutation testing is enabled, THE Mutation Tester SHALL generate a report showing surviving mutations
5. WHERE mutation testing is enabled and mutation score is below 70%, THE Mutation Tester SHALL display a warning message

### Requirement 12

**User Story:** As a developer, I want SBOM generation and license scanning in CI, so that dependency compliance is
automatically verified

#### Acceptance Criteria

1. WHEN the CI Pipeline executes, THE SBOM Generator SHALL produce a Software Bill of Materials listing all dependencies
2. WHEN the CI Pipeline executes, THE CI Pipeline SHALL scan dependencies for license compliance issues
3. THE CI Pipeline SHALL fail if dependencies have incompatible licenses
4. THE CI Pipeline SHALL upload SBOM as a workflow artifact
5. THE CI Pipeline SHALL display license scan results in the workflow summary

### Requirement 13

**User Story:** As a developer, I want PR templates with arc tracking, so that I can document ArcTDD workflow in pull requests

#### Acceptance Criteria

1. THE Documentation System SHALL provide a pull request template in .github/PULL_REQUEST_TEMPLATE.md
2. THE Documentation System SHALL include a checklist for ArcTDD arc steps in the PR template
3. THE Documentation System SHALL include sections for test-first evidence in the PR template
4. THE Documentation System SHALL include the contribution checklist from AGENTS.md in the PR template
5. THE Documentation System SHALL include fields for coverage changes and mutation testing results
