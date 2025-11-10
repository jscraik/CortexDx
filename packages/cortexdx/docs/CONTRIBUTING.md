# Contributing to CortexDx

Welcome to the CortexDx project! We're excited to have you contribute to our diagnostic meta-inspector for Model Context Protocol servers. This guide will help you get started with development, testing, and contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Code Review Process](#code-review-process)
- [Quality Standards](#quality-standards)
- [Submitting Issues](#submitting-issues)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Project Standards](#project-standards)
- [Getting Help](#getting-help)

## Getting Started

Before contributing, please familiarize yourself with:

- **[Project Vision](../../../.cortexdx/rules/vision.md)** - Our north star and roadmap
- **[AGENTS.md](../../../AGENTS.md)** - Mandatory operational instructions for all contributors
- **[CODESTYLE.md](../../../CODESTYLE.md)** - Coding standards and formatting rules

### Prerequisites

- **Node.js**: 20.11.1 (managed by Mise)
- **pnpm**: 9.12.2 (managed by Mise)
- **Git**: For version control
- **Basic understanding of**: TypeScript, MCP (Model Context Protocol), JSON-RPC

## Development Environment Setup

### 1. Install Required Tools

First, install [Mise](https://mise.jdx.dev/) to manage tool versions:

```bash
# Install Mise (choose your preferred method)
curl https://mise.run | sh
# or
brew install mise
```

### 2. Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/brainwav/cortexdx.git
cd cortexdx

# Install pinned tool versions
mise install

# Install dependencies
pnpm install
```

### 3. Verify Installation

```bash
# Run the doctor command to check your setup
cd packages/cortexdx
pnpm run doctor

# Verify build works
pnpm build

# Run tests
pnpm test

# Check linting
pnpm lint
```

### 4. Development Commands

```bash
# Development mode (with hot reload)
pnpm dev

# Run the CLI directly
pnpm dev diagnose --help

# Start development server
pnpm server

# Clean build artifacts
pnpm clean
```

## Development Workflow

We follow **ArcTDD (Architecture-Test-Driven Development)** with strict guidelines:

### 1. Planning Phase

- Understand the relevant section in [vision.md](../../../.cortexdx/rules/vision.md)
- Break work into ≤7 steps
- Ensure alignment with MCP-specific requirements

### 2. Test-First Development

- Write or update Vitest suites in `tests/` **before** implementing code
- For new plugins or adapters, include targeted tests
- Add necessary mock servers under `scripts/mock-servers/`
- Tests must be deterministic and use explicit mocks

### 3. Implementation Guidelines

- Keep functions ≤40 lines; compose helpers if necessary
- Use **named exports only** (`export const`, `export function`, `export type`)
- Avoid `any` types; use explicit types or type guards
- Ensure plugins respect read-only constraints and sandbox requirements
- Support `--deterministic` flag for reproducible results

### 4. Evidence and Documentation

- Every finding must include evidence pointers (`url`, `file`, or `log`)
- Update README/vision when introducing new flags or features
- Maintain WCAG 2.2 AA compliance for CLI outputs

### 5. Verification

- Run `pnpm lint && pnpm test && pnpm build`
- Test against mock servers when relevant: `npx cortexdx diagnose`
- Validate outputs make sense and include proper branding

### Internal Self-Improvement Diagnostics (Brainwav dev team only)

- Run `pnpm internal:self-improvement -- --endpoint http://127.0.0.1:5001` from the workspace root to execute the internal-only plugin against a local CortexDx instance.
- Optional flags: `--project <path>` to target a different package, `--history <file>` for JSON-formatted chat history, and `--out <file>` to persist findings.
- This runner executes TypeScript directly via `tsx`, stays outside the published `dist/` bundle, and satisfies the "internal only" requirement—do not enable or ship it with commercial builds.

## Testing Strategy

### Test Structure

- **Unit Tests**: `packages/cortexdx/tests/*.spec.ts`
- **Mock Servers**: `packages/cortexdx/scripts/mock-servers/`
- **Integration Tests**: End-to-end workflow validation

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (development)
pnpm test --watch

# Run specific test file
pnpm test cors.spec.ts

# Run tests with coverage
pnpm test --coverage
```

### Test Requirements

- **Coverage**: Maintain ≥65% branch coverage (PR gate)
- **Mutation Testing**: ≥75% mutation score required
- **Deterministic**: Tests must be reproducible with fixed seeds
- **Mock Usage**: Use proper mocks for network behavior
- **Evidence**: Test that findings include proper evidence pointers

### Writing Tests

- Co-locate tests with source code or use `tests/` directory
- Use descriptive test names that explain the scenario
- Test both success and failure cases
- Include tests for edge cases and error conditions
- Validate that plugins respect sandbox constraints

### Mock Servers

Available mock servers for testing:

- `ok.ts` - Healthy MCP server
- `broken-sse.ts` - SSE connection issues
- `bad-jsonrpc.ts` - Malformed JSON-RPC responses
- `bad-cors.ts` - CORS configuration problems

## Code Review Process

### Before Submitting

Complete the pre-PR checklist from [AGENTS.md](../../../AGENTS.md):

- [ ] Tests written/updated before code
- [ ] `mise install` + `pnpm install` executed
- [ ] `pnpm lint` passes (no warnings)
- [ ] `pnpm test` passes (Vitest + build)
- [ ] `pnpm build` passes (tsup + dts)
- [ ] Reports validated against at least one mock server
- [ ] README/vision/CI docs updated if needed
- [ ] Evidence pointers added/updated for new findings
- [ ] Plugin sandbox and determinism respected

### Review Criteria

Reviewers will check for:

- **Functionality**: Code works as intended and meets requirements
- **Tests**: Comprehensive test coverage with proper mocks
- **Standards**: Adherence to CODESTYLE.md and AGENTS.md
- **Security**: No hardcoded secrets, proper HAR redaction
- **Documentation**: Clear comments and updated docs
- **Performance**: Reasonable resource usage and deterministic behavior

### Review Process

1. **Automated Checks**: CI runs lint, test, build, and security scans
2. **Peer Review**: At least one maintainer review required
3. **Quality Gates**: Coverage, mutation testing, and security scans must pass
4. **Final Validation**: Manual testing against mock servers if applicable

## Quality Standards

### Code Quality

- **TypeScript**: Strict mode with explicit types at public boundaries
- **ESM Only**: Use ES modules (`"type": "module"`)
- **Named Exports**: No default exports allowed
- **Function Size**: Maximum 40 lines per function
- **No `any`**: Use proper TypeScript types

### Security Standards

- **No Secrets**: Never hardcode credentials or tokens
- **HAR Redaction**: Ensure sensitive headers are masked
- **Sandbox Compliance**: Plugins must work in worker threads
- **Read-Only**: No mutations to target MCP servers
- **AbortSignal**: Support cancellation for async operations

### Accessibility Standards

- **WCAG 2.2 AA**: CLI outputs must be screen-reader friendly
- **Severity Prefixes**: Use `[BLOCKER]`, `[MAJOR]`, `[MINOR]`, `[INFO]`
- **No Color-Only**: Avoid relying solely on color for information
- **Summary-First**: Provide clear summary lines for screen readers

### Performance Standards

- **Deterministic**: Support `--deterministic` flag
- **Resource Budgets**: Respect CPU/memory limits in plugins
- **Evidence**: All findings must include evidence pointers
- **Observability**: Use OTEL spans for long-running operations

## Submitting Issues

### Bug Reports

When reporting bugs, include:

- **Environment**: OS, Node version, pnpm version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Error Messages**: Full error output with stack traces
- **Configuration**: Relevant config files or CLI flags used

### Feature Requests

For new features:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your suggested approach
- **Alternatives**: Other solutions you've considered
- **MCP Alignment**: How it relates to MCP protocol diagnostics
- **Breaking Changes**: Any potential compatibility issues

### Security Issues

For security vulnerabilities:

- **Do NOT** create public issues
- Email security concerns to the maintainers
- Include detailed reproduction steps
- Provide suggested fixes if possible

## Pull Request Guidelines

### PR Title and Description

- Use conventional commit format: `feat:`, `fix:`, `refactor:`, etc.
- Include clear description of changes
- Reference related issues with `Fixes #123` or `Closes #123`
- Attach pre-PR checklist completion summary

### PR Content

- **Single Responsibility**: One feature or fix per PR
- **Atomic Commits**: Each commit should be a logical unit
- **Signed Commits**: All commits must be signed (GPG/SSH)
- **Tests Included**: New features must include tests
- **Documentation**: Update docs for user-facing changes

### PR Size Guidelines

- Keep PRs focused and reasonably sized
- Large changes should be broken into smaller PRs
- Consider creating draft PRs for early feedback
- Include migration guides for breaking changes

## Project Standards

### File Organization

- **Plugins**: `src/plugins/` - Diagnostic suites
- **Adapters**: `src/adapters/` - Transport implementations  
- **Reports**: `src/report/` - Output formatting
- **Workers**: `src/workers/` - Sandbox execution
- **Tests**: `tests/` - Test suites
- **Mocks**: `scripts/mock-servers/` - Test infrastructure

### Naming Conventions

- **Files/Directories**: `kebab-case`
- **Variables/Functions**: `camelCase`
- **Types/Components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Import/Export Standards

- Use named exports only: `export const`, `export function`
- Import with explicit names: `import { foo } from './bar'`
- Use import attributes for JSON: `import data from './file.json' with { type: 'json' }`
- Organize imports: external, internal, relative

## Getting Help

### Documentation

- **[User Guide](./USER_GUIDE.md)** - Complete usage documentation
- **[API Reference](./API_REFERENCE.md)** - CLI and programmatic APIs
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Community

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Code Review**: Ask questions in PR comments

### Maintainers

- Review the [AGENTS.md](../../../AGENTS.md) for current maintainer information
- Tag maintainers in issues for urgent matters
- Follow the established communication channels

## Additional Resources

### Related Documentation

- **[Vision Document](../../../.cortexdx/rules/vision.md)** - Project goals and roadmap
- **[AGENTS.md](../../../AGENTS.md)** - Operational instructions (mandatory reading)
- **[CODESTYLE.md](../../../CODESTYLE.md)** - Coding standards and toolchain
- **[Deployment Guide](./DEPLOYMENT.md)** - Production deployment guidance
- **[Plugin Development](./PLUGIN_DEVELOPMENT.md)** - Creating custom plugins

### External Resources

- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP specification
- **[Vitest Documentation](https://vitest.dev/)** - Testing framework
- **[Biome Documentation](https://biomejs.dev/)** - Linting and formatting
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript reference

## Related Documentation

### For New Contributors

- **[Getting Started](./GETTING_STARTED.md)** - Installation and first steps
- **[User Guide](./USER_GUIDE.md)** - Understanding how CortexDx works
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation

### For Plugin Developers

- **[Plugin Development](./PLUGIN_DEVELOPMENT.md)** - Creating custom diagnostic plugins
- **[IDE Integration](./IDE_INTEGRATION.md)** - Setting up development environment

### For Operations

- **[Deployment](./DEPLOYMENT.md)** - Production deployment guidance
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions

### Project Resources

- **[Main README](../../../README.md)** - Project overview and architecture
- **[Package README](../README.md)** - Package-specific information

---

Thank you for contributing to CortexDx! Your efforts help make MCP server diagnostics more reliable and secure for everyone. 🚀
