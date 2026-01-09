# CortexDx Repository Structure

This document describes the organized structure of the CortexDx monorepo after the 2025-01-05 reorganization.

## Root Directory

```
CortexDx/
├── apps/                    # Application packages (ChatGPT dashboard, etc.)
├── config/                  # Configuration files
├── configs/                 # Additional configuration
├── data/                    # Data files
├── docs/                    # Documentation (see below)
├── packages/                # Main packages (see below)
├── patches/                 # Patch files
├── scripts/                 # Utility scripts (see below)
├── reports/                 # Generated reports (see below)
├── .gitignore              # Git ignore rules
├── .mise.toml              # mise runtime configuration
├── biome.json              # Biome linter/formatter config
├── nx.json                 # Nx monorepo configuration
├── package.json            # Root package.json
├── pnpm-workspace.yaml     # pnpm workspace configuration
├── CLAUDE.md               # Claude AI assistant instructions
├── CONTRIBUTING.md         # Contribution guidelines
├── LICENSE                 # MIT License
├── README.md               # Project overview
└── CODE_OF_CONDUCT.md      # Community guidelines
```

## Documentation Structure (`docs/`)

```
docs/
├── academic/               # Academic research and enhancements
├── architecture/           # System architecture docs
├── development/            # Development workflow docs
├── fastmcp/                # FastMCP migration docs
├── internal/               # Internal reports and reviews
├── migrations/             # Migration and refactor docs
├── releases/               # Release notes and summaries
├── ARCHITECTURE.md         # Main architecture doc
├── DEVELOPER_OVERVIEW.md   # Developer getting started
├── GLOSSARY.md            # Terminology
└── README.md              # Documentation index
```

## Scripts Structure (`scripts/`)

```
scripts/
├── broken-link-monitor.js     # Link validation
├── cloudflared/               # Cloudflare tunnel scripts
├── docs-maintenance.js        # Documentation maintenance
├── governance/                # Governance automation
├── macos-services/            # macOS service setup (see below)
├── maintenance/               # Maintenance scripts
├── mcp/                       # MCP-related scripts
├── mcp-evals/                 # MCP evaluation scripts
├── migration/                 # Migration scripts (fix-*.mjs)
├── monitoring/                # Monitoring scripts
├── self/                      # Self-improvement scripts
└── various .sh/.js files      # Utility scripts
```

### macOS Services (`scripts/macos-services/`)

```
scripts/macos-services/
├── com.brainwav.cortexdx*.plist  # Launchd plist files
├── install-service.sh             # Service installation
├── uninstall-service.sh           # Service removal
├── manage-service.sh              # Service management
├── install-cloudflared.sh         # Cloudflare tunnel setup
├── manage-cloudflared.sh          # Cloudflare tunnel management
└── README.md                      # Setup instructions
```

## Reports Structure (`reports/`)

```
reports/
├── archive/              # Archived reports (>30 days old)
├── *.json               # JSON reports (recent)
├── *.md                 # Markdown reports (recent)
└── .gitignore           # Keep archive, ignore old reports
```

## Packages Structure (`packages/`)

```
packages/
├── core/                 # Core utilities and types
│   ├── src/
│   │   ├── config/      # Configuration management
│   │   ├── di/          # Dependency injection
│   │   ├── logging/     # Logging utilities
│   │   └── utils/       # Utility functions
│   └── package.json
├── cortexdx/            # Main CLI package
│   ├── src/
│   │   ├── actions/     # Action handlers
│   │   ├── adapters/    # External adapters
│   │   ├── auth/        # Authentication
│   │   ├── cli/         # CLI interface
│   │   ├── commands/    # Command definitions
│   │   ├── orchestration/ # Orchestration logic
│   │   ├── probe/       # MCP probe engine
│   │   ├── plugins/     # Plugin host
│   │   ├── resilience/  # Circuit breaker, etc.
│   │   ├── security/    # Security modules
│   │   └── ...
│   ├── tests/           # Test files
│   ├── docs/            # Package-specific docs
│   ├── reports/         # Package-specific reports
│   └── package.json
├── plugins/             # Diagnostic plugins
│   ├── src/
│   │   ├── auth/        # OAuth/Auth0 modules
│   │   ├── commands/    # Plugin commands
│   │   ├── deepcontext/ # Deep context analysis
│   │   ├── library/     # Library plugins
│   │   ├── observability/ # Observability plugins
│   │   ├── providers/   # Provider implementations
│   │   ├── registry/    # Plugin registry
│   │   ├── report/      # Report generation
│   │   └── ...
│   └── package.json
├── ml/                  # ML/LLM adapters
│   ├── src/
│   │   ├── adapters/    # Ollama, OpenAI, etc.
│   │   ├── llm/         # LLM abstractions
│   │   └── ml/          # ML utilities
│   └── package.json
├── server/              # MCP server (FastMCP)
│   ├── src/
│   │   ├── mcp-server/  # FastMCP runtime
│   │   ├── middleware/  # Server middleware
│   │   └── server/      # HTTP/WebSocket server
│   └── package.json
└── ...                  # Other packages
```

## Key Files by Purpose

### Configuration
- `nx.json` - Nx monorepo configuration
- `package.json` - Root package configuration
- `pnpm-workspace.yaml` - pnpm workspace definition
- `biome.json` - Linting and formatting rules
- `.mise.toml` - Runtime version management

### Build & CI
- `package.json` - Build scripts and dependencies
- `nx.json` - Nx task configuration

### Documentation
- `README.md` - Project overview
- `CONTRIBUTING.md` - Contribution guidelines
- `docs/` - All documentation
- `CLAUDE.md` - AI assistant instructions

### Scripts
- `scripts/migration/fix-*.mjs` - Import path fixes
- `scripts/macos-services/` - macOS service management
- `scripts/validate-*.js` - Validation scripts

## Organization Principles

1. **Clear Separation**: Source, tests, and docs are separated
2. **Categorized Docs**: Documentation organized by topic
3. **Consistent Naming**: Lowercase with hyphens for files
4. **Archive Strategy**: Old reports moved to archive/
5. **Git Hygiene**: Updated .gitignore for new structure

## Maintenance

- **Adding Docs**: Place in appropriate `docs/` subdirectory
- **Adding Scripts**: Place in appropriate `scripts/` subdirectory
- **Reports**: Generate to `reports/`, old ones auto-archived
- **Packages**: Follow monorepo conventions in `packages/`

## Reorganization Date

2025-01-05

## Migration Notes

If you have references to old file locations, update them to the new structure:

- FastMCP docs: `docs/fastmcp/`
- Migration docs: `docs/migrations/`
- Academic docs: `docs/academic/`
- macOS services: `scripts/macos-services/`
- Old reports: `reports/archive/`
