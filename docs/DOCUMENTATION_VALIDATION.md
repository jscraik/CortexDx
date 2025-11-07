# Documentation Validation

This document describes the documentation validation system for Insula MCP, which ensures consistent, high-quality documentation across the project.

## Overview

The documentation validation system performs automated checks on all markdown files to ensure:

- **Consistency**: Uniform formatting and structure
- **Quality**: Proper spelling, grammar, and content standards
- **Accuracy**: Valid links and cross-references
- **Completeness**: Required documentation files are present

## Validation Tools

### 1. Markdown Linting (markdownlint-cli2)

Validates markdown syntax and formatting consistency.

**Configuration**: `.markdownlint-cli2.jsonc`

**Key Rules**:

- Line length limit: 120 characters
- Consistent heading styles
- Proper list formatting
- No trailing whitespace

### 2. Link Checking (markdown-link-check)

Validates all links in documentation files.

**Configuration**: `.markdown-link-check.json`

**Features**:

- Checks external links for availability
- Validates internal file references
- Configurable timeout and retry logic
- Ignores localhost and example domains

### 3. Spell Checking (cspell)

Checks spelling and maintains project-specific vocabulary.

**Configuration**: `cspell.config.js`

**Features**:

- Technical vocabulary support
- Code block exclusion
- URL and path ignoring
- Custom word lists

### 4. Advanced Validation (custom script)

Performs comprehensive documentation validation.

**Script**: `scripts/validate-docs.js`

**Features**:

- File structure validation
- Cross-reference checking
- Content quality assessment
- Automated reporting

## Usage

### Local Development

```bash
# Run all documentation validation
pnpm docs:validate

# Run individual checks
pnpm docs:lint      # Markdown linting only
pnpm docs:links     # Link checking only
pnpm docs:spell     # Spell checking only
```

### CI/CD Integration

Documentation validation runs automatically on:

- Pull requests that modify markdown files
- Pushes to the main branch
- Manual workflow dispatch

**Workflow**: `.github/workflows/docs-validation.yml`

## Configuration Files

| File | Purpose |
|------|---------|
| `.markdownlint-cli2.jsonc` | Markdown linting rules |
| `.markdown-link-check.json` | Link checking configuration |
| `cspell.config.js` | Spell checking dictionary and rules |
| `.docs-validation.yml` | Overall validation configuration |

## Validation Reports

The system generates detailed reports in multiple formats:

- **JSON Report**: `docs-validation-report.json` - Machine-readable results
- **Markdown Report**: `docs-validation-report.md` - Human-readable summary

Reports include:

- Validation status (PASSED/FAILED)
- Error and warning counts
- Detailed findings with file locations
- Suggestions for improvements

## Required Documentation Files

The following files must exist and be properly maintained:

### Root Level

- `README.md` - Project overview and quick start
- `CONTRIBUTING.md` - Contribution guidelines

### Package Level

- `packages/insula-mcp/README.md` - Package-specific documentation
- `packages/insula-mcp/docs/GETTING_STARTED.md` - Installation and setup
- `packages/insula-mcp/docs/USER_GUIDE.md` - User documentation
- `packages/insula-mcp/docs/API_REFERENCE.md` - API documentation
- `packages/insula-mcp/docs/CONTRIBUTING.md` - Development guidelines
- `packages/insula-mcp/docs/TROUBLESHOOTING.md` - Common issues and solutions
- `packages/insula-mcp/docs/DEPLOYMENT.md` - Deployment instructions
- `packages/insula-mcp/docs/IDE_INTEGRATION.md` - IDE setup and integration
- `packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md` - Plugin development guide

## Best Practices

### Writing Documentation

1. **Structure**: Use clear heading hierarchy (H1 → H2 → H3)
2. **Links**: Use relative paths for internal links
3. **Code**: Use proper syntax highlighting in code blocks
4. **Length**: Keep lines under 120 characters when possible
5. **Language**: Use clear, concise language

### Maintaining Quality

1. **Regular Updates**: Keep documentation current with code changes
2. **Link Maintenance**: Regularly check and update external links
3. **Spell Check**: Add technical terms to the project dictionary
4. **Cross-References**: Ensure internal links remain valid

### Troubleshooting

#### Common Issues

**Markdown Linting Errors**:

- Check line length (max 120 characters)
- Ensure consistent heading styles
- Remove trailing whitespace

**Link Check Failures**:

- Verify external URLs are accessible
- Check internal file paths are correct
- Update moved or renamed files

**Spell Check Issues**:

- Add technical terms to `cspell.config.js`
- Use proper technical vocabulary
- Check for typos in regular text

#### Getting Help

1. Check the validation report for specific error details
2. Review configuration files for rule explanations
3. Run individual validation commands to isolate issues
4. Consult the project's CONTRIBUTING.md for guidelines

## Integration with Development Workflow

The documentation validation system integrates with the project's development workflow:

1. **Pre-commit**: Developers can run validation locally before committing
2. **Pull Requests**: Automatic validation prevents documentation regressions
3. **Continuous Integration**: Ensures documentation quality in the main branch
4. **Release Process**: Documentation validation is part of the release checklist

This ensures that documentation remains a first-class citizen in the development process, maintaining the same quality standards as the code itself.
