---
applyTo: "**/*.md"
---

# Documentation Instructions

When working with CortexDx documentation, follow these conventions:

## Markdown Standards

- Use ATX-style headers (`#`, `##`, `###`)
- Include a table of contents for documents >200 lines
- Use fenced code blocks with language specifiers
- Follow proper link formatting

## Code Examples

Always specify the language in fenced code blocks:
```typescript
// TypeScript example
export const example: ExampleType = { /* ... */ };
```

```bash
# Shell commands
pnpm lint && pnpm test && pnpm build
```

## Document Structure

1. **Title** - H1 header with clear description
2. **Overview** - Brief introduction
3. **Table of Contents** - For long documents
4. **Main Content** - Organized with H2/H3 headers
5. **Related Links** - References to other docs
6. **Support** - Contact information if applicable

## Required Updates

Update documentation when:
- Adding new CLI commands or flags
- Introducing new plugins or adapters
- Changing build/test workflows
- Modifying governance behaviors
- Adding new environment variables

## Files to Update

- `README.md` - New commands, features, setup changes
- `AGENTS.md` - Development rules and conventions
- `.cortexdx/rules/vision.md` - Architectural changes
- `docs/PLUGIN_DEVELOPMENT.md` - Plugin API changes
- `CHANGELOG.md` - All user-facing changes

## Key Documents

Reference these when making changes:
- `AGENTS.md` - Authoritative development rules
- `.cortexdx/rules/vision.md` - Project vision
- `docs/ARCHITECTURE.md` - System architecture
- `CONTRIBUTING.md` - Contribution guidelines

## Style Guidelines

- Use clear, concise language
- Include practical examples
- Maintain consistent terminology
- Use severity prefixes in CLI docs (`[BLOCKER]`, `[MAJOR]`, etc.)
- Ensure WCAG 2.2 AA compliance references for UI documentation

## Accessibility

- Ensure documentation is screen-reader friendly
- Avoid color-only references
- Use descriptive link text
- Include alt text for images
