# Contributing to CortexDx

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Community](https://img.shields.io/badge/community-inclusive-brightgreen.svg)](#community-guidelines)
[![Development](https://img.shields.io/badge/development-welcome-blue.svg)](#getting-started)

Welcome to the CortexDx project! We're excited to have you contribute to our diagnostic meta-inspector for Model Context Protocol servers. This repository-wide guide will help you understand how to contribute effectively to the entire project.

## 🚀 Quick Start for Contributors

### Repository Overview

CortexDx is a monorepo containing:

- **Core Package**: `packages/cortexdx/` - Main diagnostic tool and CLI
- **Documentation**: Comprehensive guides in `packages/cortexdx/docs/`
- **Project Rules**: Governance and standards in `.cortexdx/rules/`
- **Configuration**: Shared toolchain and quality gates

### Essential Reading

Before contributing, please review these documents based on priority:

**🔴 Must Read (Everyone):**
1. **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community standards and behavior expectations
2. **[AGENTS.md](AGENTS.md)** - Operational instructions for all contributors (mandatory)

**🟡 Important (Code Contributors):**
3. **[CODESTYLE.md](CODESTYLE.md)** - Coding standards and formatting rules
4. **[Project Vision](.cortexdx/rules/vision.md)** - North star and roadmap alignment

**🟢 Reference (As Needed):**
- [Package Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md) - Detailed development workflow
- [Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md) - Creating custom plugins
- [Glossary](docs/GLOSSARY.md) - Technical terms and definitions

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: 20.11.1 (managed by Mise)
- **pnpm**: 9.12.2 (managed by Mise)
- **Git**: With commit signing enabled (GPG/SSH)
- **Understanding of**: TypeScript, MCP protocol, JSON-RPC

### Repository Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/cortexdx.git
cd cortexdx

# 3. Install tool versions (Node, pnpm, etc.)
mise install

# 4. Install dependencies
pnpm install

# 5. Verify setup
pnpm lint && pnpm test && pnpm build
```

### Development Workflow

We follow **ArcTDD (Architecture-Test-Driven Development)**:

1. **Plan**: Understand requirements and break into ≤7 steps
2. **Test First**: Write tests before implementation
3. **Implement**: Follow coding standards and guidelines
4. **Verify**: Run quality gates and validate against mock servers
5. **Document**: Update relevant documentation

## 📋 Contribution Types

### Code Contributions

For detailed development guidelines, see:

- **[Package Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md)** - Comprehensive development guide
- **[Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md)** - Creating diagnostic plugins
- **[API Reference](packages/cortexdx/docs/API_REFERENCE.md)** - Technical specifications

### Documentation Contributions

- **User Documentation**: Guides, tutorials, and examples
- **API Documentation**: CLI and programmatic interface docs
- **Developer Documentation**: Architecture, design decisions, and workflows
- **Community Documentation**: Contributing guides, code of conduct updates

### Issue Reporting

- **Bug Reports**: Use issue templates with reproduction steps
- **Feature Requests**: Align with project vision and MCP protocol scope
- **Security Issues**: Report privately to maintainers (see [Security](#security))

## 🏗️ Repository Standards

### Mandatory Requirements

All contributions must comply with:

- **[AGENTS.md](AGENTS.md)** - Non-negotiable operational standards
- **[CODESTYLE.md](CODESTYLE.md)** - Code formatting and quality rules
- **Quality Gates**: Coverage ≥65%, mutation score ≥75%
- **Security Standards**: No hardcoded secrets, proper HAR redaction
- **Accessibility**: WCAG 2.2 AA compliance for all outputs

### Pre-Contribution Checklist

Before submitting any contribution:

- [ ] Read and understand [AGENTS.md](AGENTS.md) requirements
- [ ] Follow [CODESTYLE.md](CODESTYLE.md) formatting standards
- [ ] Ensure tests are written before code (ArcTDD)
- [ ] Run `pnpm lint && pnpm test && pnpm build` successfully
- [ ] Validate changes against mock servers when applicable
- [ ] Update documentation for user-facing changes
- [ ] Sign all commits (GPG/SSH)

### Repository Structure

```
cortexdx/
├── packages/cortexdx/          # Main package
│   ├── src/                      # Source code
│   ├── tests/                    # Test suites
│   ├── docs/                     # Package documentation
│   └── scripts/mock-servers/     # Test infrastructure
├── .cortexdx/rules/                # Project governance
├── AGENTS.md                     # Contributor requirements
├── CODESTYLE.md                  # Code standards
├── CODE_OF_CONDUCT.md           # Community guidelines
└── CONTRIBUTING.md              # This file
```

## 🤝 Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

**Key principles:**

- **Respectful Communication**: Treat all community members with courtesy
- **Inclusive Language**: Use welcoming and accessible language
- **Constructive Feedback**: Focus on ideas and code, not individuals
- **Professional Behavior**: Maintain high standards in all interactions

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests, and technical discussions
- **GitHub Discussions**: General questions, ideas, and community conversations
- **Pull Request Reviews**: Code-focused discussions and feedback
- **Security Reports**: Private communication for security vulnerabilities

### Getting Help

- **New Contributors**: Start with [Getting Started Guide](packages/cortexdx/docs/GETTING_STARTED.md)
- **Development Questions**: Check [Package Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md)
- **Technical Issues**: See [Troubleshooting Guide](packages/cortexdx/docs/TROUBLESHOOTING.md)
- **Community Support**: Use GitHub Discussions for general questions

## 🔒 Security

### Reporting Security Issues

**Do NOT create public issues for security vulnerabilities.**

Instead:

- Email security concerns to maintainers
- Include detailed reproduction steps
- Provide suggested fixes if possible
- Allow reasonable time for response and fixes

### Security Standards

All contributions must:

- Never hardcode secrets or credentials
- Properly redact sensitive information in HAR files
- Follow secure coding practices
- Respect sandbox constraints for plugins
- Support proper authentication mechanisms

## 📝 Pull Request Process

### Before Submitting

1. **Fork and Branch**: Create a feature branch from `main`
2. **Follow Standards**: Ensure compliance with AGENTS.md and CODESTYLE.md
3. **Write Tests**: Implement tests before code (ArcTDD requirement)
4. **Update Documentation**: Include relevant documentation updates
5. **Run Quality Gates**: Ensure all checks pass locally, including full-source coverage (`pnpm test -- --coverage`) which now instruments every `src/**/*.{ts,tsx}` file except generated artifacts.

### PR Requirements

- **Clear Title**: Use conventional commit format (`feat:`, `fix:`, etc.)
- **Detailed Description**: Explain changes, motivation, and impact
- **Issue References**: Link to related issues with `Fixes #123`
- **Checklist Completion**: Include pre-PR checklist from AGENTS.md
- **Signed Commits**: All commits must be signed (GPG/SSH)

### Review Process

1. **Automated Checks**: CI runs lint, test, build, and security scans
2. **Maintainer Review**: At least one maintainer approval required
3. **Quality Validation**: Coverage, mutation testing, and security gates
4. **Final Testing**: Manual validation against mock servers if applicable

### Merge Criteria

- All CI checks pass (lint, test, build, security)
- Maintainer approval received
- Quality gates met (coverage ≥85% lines/statements, ≥80% functions, ≥75% branches; mutation ≥75%)
- Documentation updated for user-facing changes
- No merge conflicts with main branch

## 🎯 Contribution Focus Areas

### High-Priority Areas

- **MCP Protocol Support**: Enhance protocol compliance and validation
- **Security Features**: Improve authentication, CORS, and threat detection
- **Plugin Development**: Create new diagnostic capabilities
- **Accessibility**: Enhance WCAG compliance and screen reader support
- **Documentation**: Improve user guides and developer resources

### Plugin Development

For creating diagnostic plugins:

- Review [Plugin Development Guide](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md)
- Ensure sandbox compliance and resource budgets
- Include comprehensive tests and evidence validation
- Follow naming conventions and export standards

### Documentation Improvements

- **User Guides**: Clear, actionable instructions for all skill levels
- **API Documentation**: Complete CLI and programmatic interface coverage
- **Examples**: Real-world usage scenarios and integration patterns
- **Troubleshooting**: Common issues and step-by-step solutions

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes to CLI or API
- **Minor**: New features, plugins, or diagnostic capabilities  
- **Patch**: Bug fixes, documentation updates, performance improvements

### Release Workflow

1. **Quality Gates**: All tests, coverage, and security checks pass
2. **Documentation**: Release notes and changelog updates
3. **Signing**: All releases are signed and include provenance
4. **Distribution**: npm package and GitHub releases
5. **Verification**: Post-release validation and monitoring

## 📚 Additional Resources

### Package-Specific Documentation

- **[Package Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md)** - Detailed development workflow
- **[User Guide](packages/cortexdx/docs/USER_GUIDE.md)** - Complete usage documentation
- **[API Reference](packages/cortexdx/docs/API_REFERENCE.md)** - CLI and programmatic APIs
- **[Plugin Development](packages/cortexdx/docs/PLUGIN_DEVELOPMENT.md)** - Creating custom plugins
- **[Troubleshooting](packages/cortexdx/docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Deployment](packages/cortexdx/docs/DEPLOYMENT.md)** - Production deployment guidance
- **[IDE Integration](packages/cortexdx/docs/IDE_INTEGRATION.md)** - Development environment setup

### Project Governance

- **[Project Vision](.cortexdx/rules/vision.md)** - Goals, roadmap, and strategic direction
- **[AGENTS.md](AGENTS.md)** - Mandatory operational instructions
- **[CODESTYLE.md](CODESTYLE.md)** - Code standards and toolchain requirements

### External Resources

- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP specification
- **[Vitest Documentation](https://vitest.dev/)** - Testing framework
- **[Biome Documentation](https://biomejs.dev/)** - Linting and formatting
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript reference

## 🙏 Recognition

We value all contributions to CortexDx:

- **Code Contributors**: Feature development, bug fixes, and improvements
- **Documentation Contributors**: Guides, examples, and clarity improvements
- **Community Contributors**: Issue reporting, discussions, and support
- **Security Contributors**: Vulnerability reports and security enhancements

All contributors are recognized in our release notes and project documentation.

## 📞 Contact

- **General Questions**: Use GitHub Discussions
- **Bug Reports**: Create GitHub Issues with templates
- **Security Issues**: Email maintainers privately
- **Feature Requests**: Submit GitHub Issues with detailed use cases

---

## Summary

Contributing to CortexDx involves:

1. **Understanding Standards**: Read AGENTS.md, CODESTYLE.md, and Code of Conduct
2. **Following Workflow**: ArcTDD methodology with test-first development
3. **Meeting Quality Gates**: Coverage, mutation testing, and security requirements
4. **Community Participation**: Respectful, inclusive, and constructive engagement
5. **Continuous Learning**: Stay aligned with project vision and MCP protocol evolution

For detailed development guidance, see the [Package Contributing Guide](packages/cortexdx/docs/CONTRIBUTING.md).

Thank you for contributing to CortexDx! Your efforts help make MCP server diagnostics more reliable and secure for everyone. 🚀

---

<div align="center">

**Built with ❤️ by [brAInwav](https://brainwav.io)**

*Empowering developers to build robust MCP implementations*

[![Community](https://img.shields.io/badge/community-welcoming-brightgreen.svg)](CODE_OF_CONDUCT.md)
[![Contributors](https://img.shields.io/badge/contributors-valued-blue.svg)](#recognition)
[![Standards](https://img.shields.io/badge/standards-high-orange.svg)](AGENTS.md)

</div>
