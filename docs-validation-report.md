# Documentation Validation Report

**Generated:** 2025-11-06T23:50:58.390Z
**Status:** FAILED
**Errors:** 21
**Warnings:** 26

## Errors

- ❌ Markdown syntax validation failed: markdownlint-cli2 v0.18.1 (markdownlint v0.38.0)
Finding: **/*.md !node_modules !.nx !dist !reports !enhanced-reports **/*.md !node_modules/** !.nx/** !dist/** !reports/** !enhanced-reports/** !packages/insula-mcp/node_modules/**
Linting: 51 file(s)
Summary: 733 error(s)

- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/_time-freshness.md" (resolved to "../../../../.cortex/rules/_time-freshness.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/vision.md" (resolved to "../../../../.cortex/rules/vision.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/agentic-coding-workflow.md" (resolved to "../../../../.cortex/rules/agentic-coding-workflow.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/TASK_FOLDER_STRUCTURE.md" (resolved to "../../../../.cortex/rules/TASK_FOLDER_STRUCTURE.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/code-review-checklist.md" (resolved to "../../../../.cortex/rules/code-review-checklist.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/CHECKLIST.cortex-os.md" (resolved to "../../../../.cortex/rules/CHECKLIST.cortex-os.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/.cortex/rules/constitution.md" (resolved to "../../../../.cortex/rules/constitution.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/docs/governance/standards-mapping.md" (resolved to "../../../../docs/governance/standards-mapping.md")
- ❌ .insula/rules/RULES_OF_AI.md: Broken internal link "/docs/governance/eu-ai-act-dates.md" (resolved to "../../../../docs/governance/eu-ai-act-dates.md")
- ❌ .insula/rules/agentic-phase-policy.md: Broken internal link "../../.github/PULL_REQUEST_TEMPLATE/default.md" (resolved to ".github/PULL_REQUEST_TEMPLATE/default.md")
- ❌ .insula/rules/code-review-checklist.md: Broken internal link "../../.github/PULL_REQUEST_TEMPLATE/default.md" (resolved to ".github/PULL_REQUEST_TEMPLATE/default.md")
- ❌ CODESTYLE.md: Broken internal link "./docs/architecture/decisions/004-node-24-active-lts.md" (resolved to "docs/architecture/decisions/004-node-24-active-lts.md")
- ❌ CODESTYLE.md: Broken internal link "./docs/architecture/decisions/004-node-24-active-lts.md" (resolved to "docs/architecture/decisions/004-node-24-active-lts.md")
- ❌ CODESTYLE.md: Broken internal link "./docs/architecture/decisions/004-node-24-active-lts.md" (resolved to "docs/architecture/decisions/004-node-24-active-lts.md")
- ❌ packages/insula-mcp/docs/API_REFERENCE.md: Broken internal link "../CONTRIBUTING.md" (resolved to "packages/insula-mcp/CONTRIBUTING.md")
- ❌ packages/insula-mcp/docs/GETTING_STARTED.md: Broken internal link "../../../docs/BEST_PRACTICES.md" (resolved to "docs/BEST_PRACTICES.md")
- ❌ packages/insula-mcp/docs/USER_GUIDE.md: Broken internal link "./README.md" (resolved to "packages/insula-mcp/docs/README.md")
- ❌ packages/insula-mcp/ide-extensions/README.md: Broken internal link "../docs/ide-integration.md" (resolved to "packages/insula-mcp/docs/ide-integration.md")
- ❌ packages/insula-mcp/ide-extensions/README.md: Broken internal link "../../AGENTS.md" (resolved to "packages/AGENTS.md")
- ❌ packages/insula-mcp/ide-extensions/README.md: Broken internal link "../docs/ide-integration.md" (resolved to "packages/insula-mcp/docs/ide-integration.md")

## Warnings

- ⚠️ Link validation failed for .insula/rules/RULES_OF_AI.md: 
FILE: .insula/rules/RULES_OF_AI.md
  [✖] /.cortex/rules/_time-freshness.md
  [✖] /.cortex/rules/vision.md
  [✖] /.cortex/rules/agentic-coding-workflow.md
  [✖] /.cortex/rules/TASK_FOLDER_STRUCTURE.md
  [✖] /.cortex/rules/code-review-checklist.md
  [✖] /.cortex/rules/CHECKLIST.cortex-os.md
  [✖] /.cortex/rules/constitution.md
  [✖] /docs/governance/standards-mapping.md
  [✖] /docs/governance/eu-ai-act-dates.md

  9 links checked.
  [✖] /.cortex/rules/_time-freshness.md → Status: 400
  [✖] /.cortex/rules/vision.md → Status: 400
  [✖] /.cortex/rules/agentic-coding-workflow.md → Status: 400
  [✖] /.cortex/rules/TASK_FOLDER_STRUCTURE.md → Status: 400
  [✖] /.cortex/rules/code-review-checklist.md → Status: 400
  [✖] /.cortex/rules/CHECKLIST.cortex-os.md → Status: 400
  [✖] /.cortex/rules/constitution.md → Status: 400
  [✖] /docs/governance/standards-mapping.md → Status: 400
  [✖] /docs/governance/eu-ai-act-dates.md → Status: 400

- ⚠️ Link validation failed for .insula/rules/agentic-coding-workflow.md: 
FILE: .insula/rules/agentic-coding-workflow.md
  [✖] ../../security/semgrep/packs/brainwav-custom.yml
  [✓] #tdd-plan-reuse-ledger-g5-evidence-hook
  [✖] ../../.github/workflows/pr-quality-gates.yml
  [✖] ../../scripts/ci/enforce-gates.mjs
  [✖] ../../scripts/ci/quality-gate-enforcer.ts
  [✖] ../../packages/security/src/policy-engine/opa
  [✖] ../../scripts/ci/verify-trace-context.ts
  [✖] ../../scripts/ci/coverage.sh
  [✖] ../../scripts/ci/summarize-coverage.mjs
  [✖] ../../scripts/ci/mutation.sh
  [✖] ../../tools/validators/axe-docs-check.ts
  [✖] ../../scripts/ci/security-scan.sh
  [✖] ../../scripts/narrated-diff.ts

  13 links checked.
  [✖] ../../security/semgrep/packs/brainwav-custom.yml → Status: 400
  [✖] ../../.github/workflows/pr-quality-gates.yml → Status: 400
  [✖] ../../scripts/ci/enforce-gates.mjs → Status: 400
  [✖] ../../scripts/ci/quality-gate-enforcer.ts → Status: 400
  [✖] ../../packages/security/src/policy-engine/opa → Status: 400
  [✖] ../../scripts/ci/verify-trace-context.ts → Status: 400
  [✖] ../../scripts/ci/coverage.sh → Status: 400
  [✖] ../../scripts/ci/summarize-coverage.mjs → Status: 400
  [✖] ../../scripts/ci/mutation.sh → Status: 400
  [✖] ../../tools/validators/axe-docs-check.ts → Status: 400
  [✖] ../../scripts/ci/security-scan.sh → Status: 400
  [✖] ../../scripts/narrated-diff.ts → Status: 400

- ⚠️ Link validation failed for .insula/rules/agentic-phase-policy.md: 
FILE: .insula/rules/agentic-phase-policy.md
  [✖] ../../.github/workflows/pr-quality-gates.yml
  [✖] ../../.github/PULL_REQUEST_TEMPLATE/default.md

  2 links checked.
  [✖] ../../.github/workflows/pr-quality-gates.yml → Status: 400
  [✖] ../../.github/PULL_REQUEST_TEMPLATE/default.md → Status: 400

- ⚠️ Link validation failed for .insula/rules/code-review-checklist.md: 
FILE: .insula/rules/code-review-checklist.md
  [✖] ../../.github/PULL_REQUEST_TEMPLATE/default.md

  1 link checked.
  [✖] ../../.github/PULL_REQUEST_TEMPLATE/default.md → Status: 400

- ⚠️ Link validation failed for CODESTYLE.md: 
FILE: CODESTYLE.md
  [✖] ./docs/architecture/decisions/004-node-24-active-lts.md
  [✖] security/semgrep/packs/brainwav-custom.yml
  [✖] security/semgrep/tests/abort-signal
  [✖] ./.eslintrc.cjs
  [✖] ./eslint.config.js

  5 links checked.
  [✖] ./docs/architecture/decisions/004-node-24-active-lts.md → Status: 400
  [✖] security/semgrep/packs/brainwav-custom.yml → Status: 400
  [✖] security/semgrep/tests/abort-signal → Status: 400
  [✖] ./.eslintrc.cjs → Status: 400
  [✖] ./eslint.config.js → Status: 400

- ⚠️ Link validation failed for CODE_OF_CONDUCT.md: 
FILE: CODE_OF_CONDUCT.md
  [✓] code_of_conduct.md
  [✓] #community-standards
  [✓] #getting-help
  [✖] mailto:conduct@cortex-os.dev
  [✖] mailto:team@cortex-os.dev
  [✖] mailto:appeals@cortex-os.dev
  [✓] CONTRIBUTING.md
  [✖] mailto:discussions@cortex-os.dev
  [✖] mailto:support@cortex-os.dev
  [✖] mailto:security@cortex-os.dev
  [✓] https://www.contributor-covenant.org/
  [✓] https://www.contributor-covenant.org/version/2/1/code_of_conduct.html
  [✓] https://github.com/mozilla/diversity
  [✓] https://www.contributor-covenant.org/faq
  [✓] https://www.contributor-covenant.org/translations
  [✓] CODE_OF_CONDUCT.md
  [✓] #our-pledge
  [✓] #reporting-guidelines
  [✓] https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg
  [✓] https://img.shields.io/badge/community-inclusive-brightgreen.svg
  [✓] https://img.shields.io/badge/support-welcoming-blue.svg
  [✓] https://img.shields.io/badge/community-guidelines-brightgreen.svg
  [✓] https://img.shields.io/badge/community-inclusive-blue.svg
  [✖] https://img.shields.io/badge/safe-space-protected-green.svg

  24 links checked.
  [✖] mailto:conduct@cortex-os.dev → Status: 400
  [✖] mailto:team@cortex-os.dev → Status: 400
  [✖] mailto:appeals@cortex-os.dev → Status: 400
  [✖] mailto:discussions@cortex-os.dev → Status: 400
  [✖] mailto:support@cortex-os.dev → Status: 400
  [✖] mailto:security@cortex-os.dev → Status: 400
  [✖] https://img.shields.io/badge/safe-space-protected-green.svg → Status: 404

- ⚠️ Link validation failed for CONTRIBUTING.md: 
FILE: CONTRIBUTING.md
  [✓] CODE_OF_CONDUCT.md
  [✖] #community-guidelines
  [✖] #getting-started
  [✓] AGENTS.md
  [✓] CODESTYLE.md
  [✓] .insula/rules/vision.md
  [✓] packages/insula-mcp/docs/CONTRIBUTING.md
  [✓] packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md
  [✓] packages/insula-mcp/docs/API_REFERENCE.md
  [✖] #security
  [✓] packages/insula-mcp/docs/GETTING_STARTED.md
  [✓] packages/insula-mcp/docs/TROUBLESHOOTING.md
  [✓] https://semver.org/
  [✓] packages/insula-mcp/docs/USER_GUIDE.md
  [✓] packages/insula-mcp/docs/DEPLOYMENT.md
  [✓] packages/insula-mcp/docs/IDE_INTEGRATION.md
  [✓] https://modelcontextprotocol.io/
  [✓] https://vitest.dev/
  [✓] https://biomejs.dev/
  [✓] https://www.typescriptlang.org/docs/
  [✓] https://brainwav.io
  [✖] #recognition
  [✓] https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg
  [✓] https://img.shields.io/badge/community-inclusive-brightgreen.svg
  [✓] https://img.shields.io/badge/development-welcome-blue.svg
  [✓] https://img.shields.io/badge/community-welcoming-brightgreen.svg
  [✓] https://img.shields.io/badge/contributors-valued-blue.svg
  [✓] https://img.shields.io/badge/standards-high-orange.svg

  28 links checked.
  [✖] #community-guidelines → Status: 404
  [✖] #getting-started → Status: 404
  [✖] #security → Status: 404
  [✖] #recognition → Status: 404

- ⚠️ Link validation failed for README.md: 
FILE: README.md
  [✖] https://github.com/brainwav/insula-mcp/actions
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp
  [✓] LICENSE
  [✓] https://nodejs.org/
  [✓] packages/insula-mcp/docs/GETTING_STARTED.md
  [✓] packages/insula-mcp/docs/USER_GUIDE.md
  [✓] packages/insula-mcp/docs/API_REFERENCE.md
  [✓] packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md
  [✓] packages/insula-mcp/docs/TROUBLESHOOTING.md
  [✓] packages/insula-mcp/docs/DEPLOYMENT.md
  [✓] packages/insula-mcp/docs/IDE_INTEGRATION.md
  [✓] packages/insula-mcp/docs/CONTRIBUTING.md
  [✓] CONTRIBUTING.md
  [✓] AGENTS.md
  [✓] https://semver.org/
  [✖] https://github.com/brainwav/insula-mcp/releases
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✖] https://github.com/brainwav/insula-mcp/discussions
  [✖] https://docs.brainwav.io/mcp
  [✓] mailto:security@brainwav.io
  [✓] https://brainwav.io
  [✖] https://github.com/brainwav/insula-mcp/workflows/Insula%20MCP%20Diagnose/badge.svg
  [✓] https://img.shields.io/npm/v/@brainwav/insula-mcp.svg
  [✓] https://img.shields.io/badge/license-Apache%202.0-blue.svg
  [✓] https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg

  25 links checked.
  [✖] https://github.com/brainwav/insula-mcp/actions → Status: 404
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp → Status: 403
  [✖] https://github.com/brainwav/insula-mcp/releases → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/discussions → Status: 404
  [✖] https://docs.brainwav.io/mcp → Status: 0
  [✖] https://github.com/brainwav/insula-mcp/workflows/Insula%20MCP%20Diagnose/badge.svg → Status: 404

- ⚠️ Link validation failed for packages/insula-mcp/README.md: 
FILE: packages/insula-mcp/README.md
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp
  [✓] LICENSE
  [✓] https://nodejs.org/
  [✓] docs/GETTING_STARTED.md
  [✓] docs/USER_GUIDE.md
  [✓] docs/API_REFERENCE.md
  [✓] docs/TROUBLESHOOTING.md
  [✓] docs/PLUGIN_DEVELOPMENT.md
  [✓] docs/IDE_INTEGRATION.md
  [✓] docs/CONTRIBUTING.md
  [✓] docs/DEPLOYMENT.md
  [✓] https://img.shields.io/npm/v/@brainwav/insula-mcp.svg
  [✓] https://img.shields.io/badge/license-Apache%202.0-blue.svg
  [✓] https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg

  14 links checked.
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp → Status: 403

- ⚠️ Link validation failed for packages/insula-mcp/docs/API_REFERENCE.md: 
FILE: packages/insula-mcp/docs/API_REFERENCE.md
  [✓] #core-interfaces
  [✓] #cli-commands
  [✓] #programmatic-api
  [✓] #configuration
  [✓] #output-formats
  [✓] #plugin-development
  [✓] #llm-integration
  [✓] #error-handling
  [✓] #typescript-types
  [✖] https://api.example.com
  [✓] ./GETTING_STARTED.md
  [✓] ./USER_GUIDE.md
  [✓] ./PLUGIN_DEVELOPMENT.md
  [✓] ./TROUBLESHOOTING.md
  [✓] ./DEPLOYMENT.md
  [✓] ./IDE_INTEGRATION.md
  [✖] https://github.com/brainwav/insula-mcp
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp
  [✓] https://spec.modelcontextprotocol.io/
  [✖] https://docs.brainwav.dev/
  [✖] https://github.com/brainwav/insula-mcp/discussions
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✖] ../CONTRIBUTING.md
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/plugins
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/integrations
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/configs

  26 links checked.
  [✖] https://api.example.com → Status: 0
  [✖] https://github.com/brainwav/insula-mcp → Status: 404
  [✖] https://www.npmjs.com/package/@brainwav/insula-mcp → Status: 403
  [✖] https://docs.brainwav.dev/ → Status: 0
  [✖] https://github.com/brainwav/insula-mcp/discussions → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404
  [✖] ../CONTRIBUTING.md → Status: 400
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/plugins → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/integrations → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/tree/main/examples/configs → Status: 404

- ⚠️ Link validation failed for packages/insula-mcp/docs/DEPLOYMENT.md: 
FILE: packages/insula-mcp/docs/DEPLOYMENT.md
  [✓] ./GETTING_STARTED.md
  [✖] mailto:support@brainwav.com

  2 links checked.
  [✖] mailto:support@brainwav.com → Status: 400

- ⚠️ Link validation failed for packages/insula-mcp/docs/GETTING_STARTED.md: 
FILE: packages/insula-mcp/docs/GETTING_STARTED.md
  [✓] ./USER_GUIDE.md
  [✓] ./API_REFERENCE.md
  [✓] ./TROUBLESHOOTING.md
  [✓] ./PLUGIN_DEVELOPMENT.md
  [✓] ./IDE_INTEGRATION.md
  [✓] ./CONTRIBUTING.md
  [✓] ./DEPLOYMENT.md
  [✖] ../../../docs/BEST_PRACTICES.md
  [✓] ../../../README.md
  [✓] ../README.md
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✖] https://github.com/brainwav/insula-mcp/discussions

  12 links checked.
  [✖] ../../../docs/BEST_PRACTICES.md → Status: 400
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/discussions → Status: 404

- ⚠️ Link validation failed for packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md: 
FILE: packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md
  [✖] ./examples
  [✖] ./LICENSE
  [✓] ./API_REFERENCE.md
  [✓] ./USER_GUIDE.md
  [✓] ./CONTRIBUTING.md
  [✓] ./TROUBLESHOOTING.md
  [✓] ../src/plugins/
  [✓] ../src/sdk/plugin-templates.ts

  8 links checked.
  [✖] ./examples → Status: 400
  [✖] ./LICENSE → Status: 400

- ⚠️ Link validation failed for packages/insula-mcp/docs/TROUBLESHOOTING.md: 
FILE: packages/insula-mcp/docs/TROUBLESHOOTING.md
  [✖] https://github.com/brainwav/insula-mcp/issues/new
  [✓] ./GETTING_STARTED.md
  [✓] ./USER_GUIDE.md
  [✓] ./API_REFERENCE.md
  [✓] ./PLUGIN_DEVELOPMENT.md
  [✓] ./DEPLOYMENT.md
  [✓] ./CONTRIBUTING.md
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✖] https://github.com/brainwav/insula-mcp/discussions
  [✖] https://github.com/brainwav/insula-mcp/tree/main/docs
  [✖] https://brainwav.dev

  11 links checked.
  [✖] https://github.com/brainwav/insula-mcp/issues/new → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/discussions → Status: 404
  [✖] https://github.com/brainwav/insula-mcp/tree/main/docs → Status: 404
  [✖] https://brainwav.dev → Status: 0

- ⚠️ Link validation failed for packages/insula-mcp/docs/USER_GUIDE.md: 
FILE: packages/insula-mcp/docs/USER_GUIDE.md
  [✓] #overview
  [✓] #installation
  [✓] #basic-usage
  [✓] #command-reference
  [✓] #configuration
  [✓] #integration-patterns
  [✓] #output-formats
  [✓] #common-workflows
  [✓] #best-practices
  [✓] #faq
  [✓] ../README.md#documentation
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✓] ./GETTING_STARTED.md
  [✓] ./TROUBLESHOOTING.md
  [✓] ./API_REFERENCE.md
  [✓] ./PLUGIN_DEVELOPMENT.md
  [✓] ./IDE_INTEGRATION.md
  [✓] ./DEPLOYMENT.md
  [✓] ./CONTRIBUTING.md
  [✓] ../../../README.md
  [✓] ../README.md
  [✓] ../../../LICENSE
  [✖] ./README.md

  23 links checked.
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404
  [✖] ./README.md → Status: 400

- ⚠️ Link validation failed for packages/insula-mcp/ide-extensions/README.md: 
FILE: packages/insula-mcp/ide-extensions/README.md
  [✖] ../docs/ide-integration.md
  [✖] http://localhost:3000
  [✖] ../../AGENTS.md
  [✖] https://github.com/brainwav/insula-mcp/issues
  [✓] https://spec.modelcontextprotocol.io/
  [✓] ../LICENSE

  6 links checked.
  [✖] ../docs/ide-integration.md → Status: 400
  [✖] http://localhost:3000 → Status: 0
  [✖] ../../AGENTS.md → Status: 400
  [✖] https://github.com/brainwav/insula-mcp/issues → Status: 404

- ⚠️ Spelling validation found issues: AGENTS.md:4:15 - Unknown word (jamiescottcraik)
AGENTS.md:30:6 - Unknown word (WCAG)
AGENTS.md:41:9 - Unknown word (Inwav)
AGENTS.md:75:13 - Unknown word (sandboxed)
AGENTS.md:87:170 - Unknown word (sandboxed)
AGENTS.md:102:116 - Unknown word (behaviour)
AGENTS.md:125:97 - Unknown word (behaviour)
AGENTS.md:126:29 - Unknown word (Semgrep)
AGENTS.md:136:42 - Unknown word (WCAG)
AGENTS.md:148:58 - Unknown word (behaviours)
AGENTS.md:156:12 - Unknown word (Negotiables)
CODE_OF_CONDUCT.md:97:48 - Unknown word (hackathons)
CODE_OF_CONDUCT.md:248:5 - Unknown word (Inclusivity)
CODESTYLE.md:6:158 - Unknown word (Clippy)
CODESTYLE.md:6:166 - Unknown word (pytest)
CODESTYLE.md:6:192 - Unknown word (Semgrep)
CODESTYLE.md:7:166 - Unknown word (rustc)
CODESTYLE.md:11:10 - Unknown word (Inwav)
CODESTYLE.md:24:63 - Unknown word (Inwav)
CODESTYLE.md:25:118 - Unknown word (Inwav)
CODESTYLE.md:31:29 - Unknown word (Semgrep)
CODESTYLE.md:106:46 - Unknown word (Inwav)
CODESTYLE.md:245:5 - Unknown word (WCAG)
CODESTYLE.md:253:34 - Unknown word (funcs)
CODESTYLE.md:256:32 - Unknown word (pyproject)
CODESTYLE.md:258:17 - Unknown word (pytest)
CODESTYLE.md:265:27 - Unknown word (rustc)
CODESTYLE.md:266:41 - Unknown word (clippy)
CODESTYLE.md:267:92 - Unknown word (thiserror)
CODESTYLE.md:268:12 - Unknown word (ratatui) fix: (ratatouille)
CODESTYLE.md:268:22 - Unknown word (crossterm)
CODESTYLE.md:286:56 - Unknown word (Sigstore)
CODESTYLE.md:286:67 - Unknown word (Gitsign)
CODESTYLE.md:292:19 - Unknown word (Lockfiles)
CODESTYLE.md:298:5 - Unknown word (Lockfiles)
CODESTYLE.md:338:26 - Unknown word (codemods)
CODESTYLE.md:342:11 - Unknown word (codemod)
CODESTYLE.md:355:24 - Unknown word (Semgrep)
CODESTYLE.md:359:15 - Unknown word (SLSA)
CODESTYLE.md:360:24 - Unknown word (Sigstore)
CODESTYLE.md:364:34 - Unknown word (distroless)
CODESTYLE.md:372:24 - Unknown word (Datasheets)
CODESTYLE.md:390:34 - Unknown word (Semgrep)
CODESTYLE.md:394:26 - Unknown word (semgrep)
CODESTYLE.md:394:37 - Unknown word (Inwav)
CODESTYLE.md:395:27 - Unknown word (semgrep)
CODESTYLE.md:396:31 - Unknown word (semgrep)
CODESTYLE.md:397:12 - Unknown word (brainwav)
CODESTYLE.md:397:39 - Unknown word (semgrep)
CODESTYLE.md:398:22 - Unknown word (abortsignal)
CODESTYLE.md:398:38 - Unknown word (semgrep)
CODESTYLE.md:413:17 - Unknown word (WCAG)
CODESTYLE.md:441:7 - Unknown word (nxignore)
CODESTYLE.md:449:5 - Unknown word (Codemap)
CODESTYLE.md:450:11 - Unknown word (codemap)
CODESTYLE.md:450:34 - Unknown word (codemap)
CODESTYLE.md:450:61 - Unknown word (codemap)
CODESTYLE.md:450:82 - Unknown word (codemap)
CODESTYLE.md:455:12 - Unknown word (sparkline)
CODESTYLE.md:455:92 - Unknown word (sparkline)
CODESTYLE.md:464:80 - Unknown word (scriptable)
CODESTYLE.md:473:16 - Unknown word (pyproject)
CODESTYLE.md:474:30 - Unknown word (Clippy)
CODESTYLE.md:485:5 - Unknown word (GPAI)
CODESTYLE.md:487:5 - Unknown word (GPAI)
CODESTYLE.md:491:36 - Unknown word (Semgrep)
CODESTYLE.md:493:99 - Unknown word (brainwav)
CODESTYLE.md:493:281 - Unknown word (brainwav)
CODESTYLE.md:493:326 - Unknown word (brainwav)
CODESTYLE.md:493:379 - Unknown word (brainwav)
CONTRIBUTING.md:99:22 - Unknown word (WCAG)
CONTRIBUTING.md:219:30 - Unknown word (WCAG)
CONTRIBUTING.md:319:24 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:301:14 - Unknown word (brainwav)
packages/insula-mcp/docs/API_REFERENCE.md:307:31 - Unknown word (brainwav)
packages/insula-mcp/docs/API_REFERENCE.md:348:8 - Unknown word (Ollama)
packages/insula-mcp/docs/API_REFERENCE.md:355:11 - Unknown word (Ollama)
packages/insula-mcp/docs/API_REFERENCE.md:382:31 - Unknown word (brainwav)
packages/insula-mcp/docs/API_REFERENCE.md:431:15 - Unknown word (ollama)
packages/insula-mcp/docs/API_REFERENCE.md:431:34 - Unknown word (llamacpp)
packages/insula-mcp/docs/API_REFERENCE.md:461:16 - Unknown word (Ollama)
packages/insula-mcp/docs/API_REFERENCE.md:461:57 - Unknown word (brainwav)
packages/insula-mcp/docs/API_REFERENCE.md:463:4 - Unknown word (Ollama)
packages/insula-mcp/docs/API_REFERENCE.md:464:7 - Unknown word (ollama)
packages/insula-mcp/docs/API_REFERENCE.md:464:22 - Unknown word (Ollama)
packages/insula-mcp/docs/API_REFERENCE.md:475:24 - Unknown word (ollama)
packages/insula-mcp/docs/API_REFERENCE.md:482:130 - Unknown word (sandboxed)
packages/insula-mcp/docs/API_REFERENCE.md:487:69 - Unknown word (brainwav)
packages/insula-mcp/docs/API_REFERENCE.md:745:16 - Unknown word (sandboxed)
packages/insula-mcp/docs/API_REFERENCE.md:1026:27 - Unknown word (asyncio)
packages/insula-mcp/docs/API_REFERENCE.md:1179:27 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/API_REFERENCE.md:1200:9 - Unknown word (usecases)
packages/insula-mcp/docs/API_REFERENCE.md:1298:5 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:1299:5 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:1300:5 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:1301:5 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:1302:5 - Unknown word (Inwav)
packages/insula-mcp/docs/API_REFERENCE.md:1341:17 - Unknown word (ollama)
packages/insula-mcp/docs/API_REFERENCE.md:1365:38 - Unknown word (arctdd)
packages/insula-mcp/docs/API_REFERENCE.md:1470:28 - Unknown word (ollama)
packages/insula-mcp/docs/API_REFERENCE.md:1740:19 - Unknown word (arctdd)
packages/insula-mcp/docs/API_REFERENCE.md:1822:19 - Unknown word (fileplan)
packages/insula-mcp/docs/API_REFERENCE.md:1862:26 - Unknown word (fileplan)
packages/insula-mcp/docs/API_REFERENCE.md:1865:28 - Unknown word (fileplan)
packages/insula-mcp/docs/CONTRIBUTING.md:122:12 - Unknown word (WCAG)
packages/insula-mcp/docs/CONTRIBUTING.md:233:5 - Unknown word (WCAG)
packages/insula-mcp/docs/DEPLOYMENT.md:51:13 - Unknown word (brainwav)
packages/insula-mcp/docs/DEPLOYMENT.md:59:3 - Unknown word (brainwav)
packages/insula-mcp/docs/DEPLOYMENT.md:70:3 - Unknown word (brainwav)
packages/insula-mcp/docs/DEPLOYMENT.md:84:3 - Unknown word (brainwav)
packages/insula-mcp/docs/DEPLOYMENT.md:109:5 - Unknown word (cpus)
packages/insula-mcp/docs/DEPLOYMENT.md:118:15 - Unknown word (BUILDKIT)
packages/insula-mcp/docs/DEPLOYMENT.md:122:16 - Unknown word (brainwav)
packages/insula-mcp/docs/DEPLOYMENT.md:123:15 - Unknown word (BUILDKIT)
packages/insula-mcp/docs/DEPLOYMENT.md:128:14 - Unknown word (cves)
packages/insula-mcp/docs/DEPLOYMENT.md:130:3 - Unknown word (aquasec)
packages/insula-mcp/docs/DEPLOYMENT.md:138:5 - Unknown word (tmpfs)
packages/insula-mcp/docs/DEPLOYMENT.md:138:19 - Unknown word (noexec)
packages/insula-mcp/docs/DEPLOYMENT.md:138:26 - Unknown word (nosuid)
packages/insula-mcp/docs/DEPLOYMENT.md:145:5 - Unknown word (cpus)
packages/insula-mcp/docs/DEPLOYMENT.md:146:5 - Unknown word (pids)
packages/insula-mcp/docs/DEPLOYMENT.md:180:34 - Unknown word (Ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:181:46 - Unknown word (ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:184:44 - Unknown word (ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:268:24 - Unknown word (yourdomain)
packages/insula-mcp/docs/DEPLOYMENT.md:344:14 - Unknown word (cves)
packages/insula-mcp/docs/DEPLOYMENT.md:438:5 - Unknown word (maxconn)
packages/insula-mcp/docs/DEPLOYMENT.md:446:12 - Unknown word (httplog)
packages/insula-mcp/docs/DEPLOYMENT.md:455:13 - Unknown word (roundrobin)
packages/insula-mcp/docs/DEPLOYMENT.md:456:12 - Unknown word (httpchk)
packages/insula-mcp/docs/DEPLOYMENT.md:476:28 - Unknown word (yourdomain)
packages/insula-mcp/docs/DEPLOYMENT.md:482:28 - Unknown word (yourdomain)
packages/insula-mcp/docs/DEPLOYMENT.md:517:11 - Unknown word (THREADPOOL)
packages/insula-mcp/docs/DEPLOYMENT.md:557:5 - Unknown word (maxmemory)
packages/insula-mcp/docs/DEPLOYMENT.md:558:5 - Unknown word (maxmemory)
packages/insula-mcp/docs/DEPLOYMENT.md:558:22 - Unknown word (allkeys)
packages/insula-mcp/docs/DEPLOYMENT.md:562:9 - Unknown word (keepalive)
packages/insula-mcp/docs/DEPLOYMENT.md:588:30 - Unknown word (ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:588:47 - Unknown word (llamacpp)
packages/insula-mcp/docs/DEPLOYMENT.md:588:68 - Unknown word (ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:589:4 - Unknown word (OLLAMA)
packages/insula-mcp/docs/DEPLOYMENT.md:589:18 - Unknown word (Ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:590:4 - Unknown word (OLLAMA)
packages/insula-mcp/docs/DEPLOYMENT.md:590:21 - Unknown word (Ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:592:4 - Unknown word (LLAMACPP)
packages/insula-mcp/docs/DEPLOYMENT.md:633:7 - Unknown word (THREADPOOL)
packages/insula-mcp/docs/DEPLOYMENT.md:633:25 - Unknown word (libuv)
packages/insula-mcp/docs/DEPLOYMENT.md:752:19 - Unknown word (ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:753:29 - Unknown word (codellama)
packages/insula-mcp/docs/DEPLOYMENT.md:1015:18 - Unknown word (singlestat)
packages/insula-mcp/docs/DEPLOYMENT.md:1115:8 - Unknown word (smarthost)
packages/insula-mcp/docs/DEPLOYMENT.md:1121:15 - Unknown word (alertname)
packages/insula-mcp/docs/DEPLOYMENT.md:1142:41 - Unknown word (alertname)
packages/insula-mcp/docs/DEPLOYMENT.md:1151:45 - Unknown word (alertname)
packages/insula-mcp/docs/DEPLOYMENT.md:1156:40 - Unknown word (alertname)
packages/insula-mcp/docs/DEPLOYMENT.md:1160:38 - Unknown word (alertname)
packages/insula-mcp/docs/DEPLOYMENT.md:1213:22 - Unknown word (Ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:1266:10 - Unknown word (pipefail)
packages/insula-mcp/docs/DEPLOYMENT.md:1285:13 - Unknown word (configmap)
packages/insula-mcp/docs/DEPLOYMENT.md:1300:24 - Unknown word (cnpg)
packages/insula-mcp/docs/DEPLOYMENT.md:1315:5 - Unknown word (initdb)
packages/insula-mcp/docs/DEPLOYMENT.md:1340:3 - Unknown word (psql)
packages/insula-mcp/docs/DEPLOYMENT.md:1396:15 - Unknown word (configmap)
packages/insula-mcp/docs/DEPLOYMENT.md:1418:15 - Unknown word (configmap)
packages/insula-mcp/docs/DEPLOYMENT.md:1443:7 - Unknown word (tuln)
packages/insula-mcp/docs/DEPLOYMENT.md:1448:25 - Unknown word (Iseconds)
packages/insula-mcp/docs/DEPLOYMENT.md:1512:10 - Unknown word (tulpn)
packages/insula-mcp/docs/DEPLOYMENT.md:1513:5 - Unknown word (tulpn)
packages/insula-mcp/docs/DEPLOYMENT.md:1517:11 - Unknown word (curlimages)
packages/insula-mcp/docs/DEPLOYMENT.md:1531:3 - Unknown word (nslookup)
packages/insula-mcp/docs/DEPLOYMENT.md:1551:9 - Unknown word (Ollama)
packages/insula-mcp/docs/DEPLOYMENT.md:1568:35 - Unknown word (OLLAMA)
packages/insula-mcp/docs/DEPLOYMENT.md:1569:75 - Unknown word (OLLAMA)
packages/insula-mcp/docs/DEPLOYMENT.md:1583:6 - Unknown word (isready)
packages/insula-mcp/docs/DEPLOYMENT.md:1617:13 - Unknown word (storageclass)
packages/insula-mcp/docs/DEPLOYMENT.md:1618:18 - Unknown word (storageclass)
packages/insula-mcp/docs/DEPLOYMENT.md:1650:12 - Unknown word (pgrep)
packages/insula-mcp/docs/DEPLOYMENT.md:1714:10 - Unknown word (pipefail)
packages/insula-mcp/docs/DEPLOYMENT.md:1745:6 - Unknown word (isready)
packages/insula-mcp/docs/DEPLOYMENT.md:1784:3 - Unknown word (psql)
packages/insula-mcp/docs/DEPLOYMENT.md:2099:3 - Unknown word (psql)
packages/insula-mcp/docs/DEPLOYMENT.md:2120:10 - Unknown word (pipefail)
packages/insula-mcp/docs/GETTING_STARTED.md:7:18 - Unknown word (agentic)
packages/insula-mcp/docs/GETTING_STARTED.md:29:24 - Unknown word (Ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:59:17 - Unknown word (brainwav)
packages/insula-mcp/docs/GETTING_STARTED.md:70:6 - Unknown word (brainwav)
packages/insula-mcp/docs/GETTING_STARTED.md:73:6 - Unknown word (brainwav)
packages/insula-mcp/docs/GETTING_STARTED.md:114:5 - Unknown word (Inwav)
packages/insula-mcp/docs/GETTING_STARTED.md:131:4 - Unknown word (Inwav)
packages/insula-mcp/docs/GETTING_STARTED.md:163:5 - Unknown word (Inwav)
packages/insula-mcp/docs/GETTING_STARTED.md:186:5 - Unknown word (Inwav)
packages/insula-mcp/docs/GETTING_STARTED.md:236:5 - Unknown word (Inwav)
packages/insula-mcp/docs/GETTING_STARTED.md:283:17 - Unknown word (brainwav)
packages/insula-mcp/docs/GETTING_STARTED.md:305:6 - Unknown word (brainwav)
packages/insula-mcp/docs/GETTING_STARTED.md:323:15 - Unknown word (findstr)
packages/insula-mcp/docs/GETTING_STARTED.md:413:32 - Unknown word (Ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:417:16 - Unknown word (Ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:420:11 - Unknown word (Ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:424:1 - Unknown word (ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:426:31 - Unknown word (Ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:500:17 - Unknown word (ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:523:27 - Unknown word (ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:552:25 - Unknown word (ollama)
packages/insula-mcp/docs/GETTING_STARTED.md:584:7 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/GETTING_STARTED.md:622:1 - Unknown word (ollama)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1662:21 - Unknown word (ollama)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1800:13 - Unknown word (myorg)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1853:7 - Unknown word (brainwav)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1872:16 - Unknown word (brainwav)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1918:7 - Unknown word (brainwav)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1941:14 - Unknown word (myorg)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:1949:59 - Unknown word (myorg)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:2215:28 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/PLUGIN_DEVELOPMENT.md:2217:35 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:32:4 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/TROUBLESHOOTING.md:33:4 - Unknown word (ENOTFOUND)
packages/insula-mcp/docs/TROUBLESHOOTING.md:33:15 - Unknown word (getaddrinfo)
packages/insula-mcp/docs/TROUBLESHOOTING.md:33:27 - Unknown word (ENOTFOUND)
packages/insula-mcp/docs/TROUBLESHOOTING.md:34:4 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:34:23 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:46:11 - Unknown word (libexec)
packages/insula-mcp/docs/TROUBLESHOOTING.md:46:39 - Unknown word (socketfilterfw)
packages/insula-mcp/docs/TROUBLESHOOTING.md:46:56 - Unknown word (getglobalstate)
packages/insula-mcp/docs/TROUBLESHOOTING.md:56:5 - Unknown word (tlnp)
packages/insula-mcp/docs/TROUBLESHOOTING.md:57:10 - Unknown word (tlnp)
packages/insula-mcp/docs/TROUBLESHOOTING.md:71:15 - Unknown word (findstr)
packages/insula-mcp/docs/TROUBLESHOOTING.md:175:23 - Unknown word (newkey)
packages/insula-mcp/docs/TROUBLESHOOTING.md:175:40 - Unknown word (keyout)
packages/insula-mcp/docs/TROUBLESHOOTING.md:179:23 - Unknown word (newkey)
packages/insula-mcp/docs/TROUBLESHOOTING.md:179:40 - Unknown word (keyout)
packages/insula-mcp/docs/TROUBLESHOOTING.md:195:4 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:195:23 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:231:4 - Unknown word (traceroute)
packages/insula-mcp/docs/TROUBLESHOOTING.md:244:4 - Unknown word (tracert)
packages/insula-mcp/docs/TROUBLESHOOTING.md:247:4 - Unknown word (nslookup)
packages/insula-mcp/docs/TROUBLESHOOTING.md:394:25 - Unknown word (Ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:408:11 - Unknown word (Ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:410:1 - Unknown word (ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:413:21 - Unknown word (Ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:416:11 - Unknown word (Ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:420:14 - Unknown word (ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:422:9 - Unknown word (Ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:423:1 - Unknown word (ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:424:1 - Unknown word (ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:434:23 - Unknown word (ollama)
packages/insula-mcp/docs/TROUBLESHOOTING.md:445:10 - Unknown word (winget)
packages/insula-mcp/docs/TROUBLESHOOTING.md:446:1 - Unknown word (winget)
packages/insula-mcp/docs/TROUBLESHOOTING.md:571:9 - Unknown word (powermetrics)
packages/insula-mcp/docs/TROUBLESHOOTING.md:665:30 - Unknown word (USERPROFILE)
packages/insula-mcp/docs/TROUBLESHOOTING.md:689:17 - Unknown word (huggingface)
packages/insula-mcp/docs/TROUBLESHOOTING.md:696:19 - Unknown word (huggingface)
packages/insula-mcp/docs/TROUBLESHOOTING.md:718:17 - Unknown word (myorg)
packages/insula-mcp/docs/TROUBLESHOOTING.md:724:37 - Unknown word (brainwav)
packages/insula-mcp/docs/TROUBLESHOOTING.md:839:44 - Unknown word (permissioning)
packages/insula-mcp/docs/TROUBLESHOOTING.md:862:17 - Unknown word (loadavg)
packages/insula-mcp/docs/TROUBLESHOOTING.md:881:4 - Unknown word (swapon)
packages/insula-mcp/docs/TROUBLESHOOTING.md:955:15 - Unknown word (pgrep)
packages/insula-mcp/docs/TROUBLESHOOTING.md:968:14 - Unknown word (pgrep)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1105:29 - Unknown word (tcpdump)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1106:9 - Unknown word (tcpdump)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1113:4 - Unknown word (journalctl)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1116:9 - Unknown word (tcpdump)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1125:29 - Unknown word (netsh)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1126:4 - Unknown word (netsh)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1126:34 - Unknown word (tracefile)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1128:4 - Unknown word (netsh)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1139:27 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1221:4 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1222:4 - Unknown word (ETIMEDOUT)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1223:4 - Unknown word (ENOTFOUND)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1224:4 - Unknown word (EADDRINUSE)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1245:19 - Unknown word (ECONNREFUSED)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1245:44 - Unknown word (ENOTFOUND)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1327:16 - Unknown word (brainwav)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1330:18 - Unknown word (brainwav)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1402:39 - Unknown word (xattr)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1425:52 - Unknown word (sestatus)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1434:5 - Unknown word (tlnp)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1437:15 - Unknown word (tulpn)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1491:19 - Unknown word (brainwav)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1492:17 - Unknown word (brainwav)
packages/insula-mcp/docs/TROUBLESHOOTING.md:1539:61 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:52:17 - Unknown word (brainwav)
packages/insula-mcp/docs/USER_GUIDE.md:67:17 - Unknown word (brainwav)
packages/insula-mcp/docs/USER_GUIDE.md:83:17 - Unknown word (brainwav)
packages/insula-mcp/docs/USER_GUIDE.md:92:6 - Unknown word (brainwav)
packages/insula-mcp/docs/USER_GUIDE.md:95:6 - Unknown word (brainwav)
packages/insula-mcp/docs/USER_GUIDE.md:133:5 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:150:7 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:168:20 - Unknown word (arctdd)
packages/insula-mcp/docs/USER_GUIDE.md:169:20 - Unknown word (fileplan)
packages/insula-mcp/docs/USER_GUIDE.md:495:9 - Unknown word (usecases)
packages/insula-mcp/docs/USER_GUIDE.md:576:5 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:645:38 - Unknown word (arctdd)
packages/insula-mcp/docs/USER_GUIDE.md:752:62 - Unknown word (permissioning)
packages/insula-mcp/docs/USER_GUIDE.md:760:38 - Unknown word (arctdd)
packages/insula-mcp/docs/USER_GUIDE.md:939:11 - Unknown word (elif)
packages/insula-mcp/docs/USER_GUIDE.md:1122:5 - Unknown word (healthcheck)
packages/insula-mcp/docs/USER_GUIDE.md:1186:18 - Unknown word (piechart)
packages/insula-mcp/docs/USER_GUIDE.md:1321:1 - Unknown word (elif)
packages/insula-mcp/docs/USER_GUIDE.md:1403:36 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:1479:38 - Unknown word (Inwav)
packages/insula-mcp/docs/USER_GUIDE.md:1555:44 - Unknown word (arctdd)
packages/insula-mcp/docs/USER_GUIDE.md:1593:21 - Unknown word (keepalive)
packages/insula-mcp/docs/USER_GUIDE.md:1595:41 - Unknown word (keepalive)
packages/insula-mcp/docs/USER_GUIDE.md:1612:11 - Unknown word (keepalive)
packages/insula-mcp/docs/USER_GUIDE.md:1613:9 - Unknown word (keepalive)
packages/insula-mcp/docs/USER_GUIDE.md:1614:23 - Unknown word (keepalive)
packages/insula-mcp/docs/USER_GUIDE.md:1737:27 - Unknown word (fileplan)
packages/insula-mcp/docs/USER_GUIDE.md:1825:8 - Unknown word (SARIF)
packages/insula-mcp/docs/USER_GUIDE.md:1825:48 - Unknown word (sarif)
packages/insula-mcp/docs/USER_GUIDE.md:1883:74 - Unknown word (arctdd)
packages/insula-mcp/docs/USER_GUIDE.md:1889:74 - Unknown word (sarif)
packages/insula-mcp/docs/USER_GUIDE.md:1984:45 - Unknown word (permissioning)
packages/insula-mcp/docs/USER_GUIDE.md:2135:18 - Unknown word (sarif)
packages/insula-mcp/docs/USER_GUIDE.md:2249:17 - Unknown word (permissioning)
packages/insula-mcp/docs/USER_GUIDE.md:2264:13 - Unknown word (sarif)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:37:10 - Unknown word (keepalive)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:43:22 - Unknown word (Inwav)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:43:28 - Unknown word (BMAD)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:51:16 - Unknown word (BMAD)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:51:38 - Unknown word (Inwav)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:94:34 - Unknown word (permissioning)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:98:11 - Unknown word (permissioning)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:117:10 - Unknown word (keepalive)
packages/insula-mcp/enhanced-reports/insula-arctdd.md:139:7 - Unknown word (Inwav)
packages/insula-mcp/enhanced-reports/insula-report.md:1:36 - Unknown word (Inwav)
packages/insula-mcp/enhanced-reports/insula-report.md:22:34 - Unknown word (permissioning)
packages/insula-mcp/enhanced-reports/insula-report.md:39:9 - Unknown word (Inwav)
packages/insula-mcp/enhanced-reports/insula-report.md:39:15 - Unknown word (BMAD)
packages/insula-mcp/enhanced-reports/insula-report.md:54:39 - Unknown word (exfil)
packages/insula-mcp/enhanced-reports/insula-report.md:58:18 - Unknown word (Backpressure)
packages/insula-mcp/enhanced-reports/insula-report.md:80:39 - Unknown word (ucvo)
packages/insula-mcp/ide-extensions/README.md:45:3 - Unknown word (gradlew)
packages/insula-mcp/ide-extensions/README.md:98:3 - Unknown word (gradlew)
packages/insula-mcp/ide-extensions/README.md:115:3 - Unknown word (gradlew)
packages/insula-mcp/README.md:1:4 - Unknown word (brainwav)
packages/insula-mcp/README.md:13:17 - Unknown word (brainwav)
packages/insula-mcp/README.md:16:6 - Unknown word (brainwav)
packages/insula-mcp/README.md:57:5 - Unknown word (Inwav)
packages/insula-mcp/README.md:69:20 - Unknown word (arctdd)
packages/insula-mcp/README.md:70:20 - Unknown word (fileplan)
packages/insula-mcp/README.md:136:6 - Unknown word (permissioning)
packages/insula-mcp/README.md:157:36 - Unknown word (Inwav)
packages/insula-mcp/README.md:187:29 - Unknown word (arctdd)
packages/insula-mcp/README.md:199:8 - Unknown word (keepalive)
packages/insula-mcp/README.md:202:27 - Unknown word (fileplan)
packages/insula-mcp/README.md:287:16 - Unknown word (brainwav)
packages/insula-mcp/reports/insula-arctdd.md:17:10 - Unknown word (keepalive)
packages/insula-mcp/reports/insula-arctdd.md:63:7 - Unknown word (Inwav)
packages/insula-mcp/reports/insula-report.md:1:36 - Unknown word (Inwav)
packages/insula-mcp/research-based-improvements.md:1:6 - Unknown word (assistanvelopmenical)
packages/insula-mcp/research-based-improvements.md:1:27 - Unknown word (deing)
packages/insula-mcp/research-based-improvements.md:1:33 - Unknown word (practovidhile)
packages/insula-mcp/research-based-improvements.md:1:47 - Unknown word (printegrity)
packages/insula-mcp/research-based-improvements.md:1:59 - Unknown word (wsearch)
packages/insula-mcp/research-based-improvements.md:1:88 - Unknown word (highesttainthat)
packages/insula-mcp/research-based-improvements.md:1:110 - Unknown word (ased)
packages/insula-mcp/research-based-improvements.md:1:135 - Unknown word (validatcademicallinto)
packages/insula-mcp/research-based-improvements.md:1:171 - Unknown word (previerms)
packages/insula-mcp/research-based-improvements.md:1:181 - Unknown word (thransfo)
packages/insula-mcp/research-based-improvements.md:1:190 - Unknown word (tapproachch)
packages/insula-mcp/research-based-improvements.md:1:209 - Unknown word (resear)
packages/insula-mcp/research-based-improvements.md:3:6 - Unknown word (earch) fix: (search, each)
packages/insula-mcp/research-based-improvements.md:3:12 - Unknown word (resicdem)
packages/insula-mcp/research-based-improvements.md:3:24 - Unknown word (acaons)
packages/insula-mcp/research-based-improvements.md:3:31 - Unknown word (backeduggesti)
packages/insula-mcp/research-based-improvements.md:3:60 - Unknown word (Svidence)
packages/insula-mcp/research-based-improvements.md:4:1 - Unknown word (dationsenecommed)
packages/insula-mcp/research-based-improvements.md:5:3 - Unknown word (revi)
packages/insula-mcp/research-based-improvements.md:5:13 - Unknown word (pmprovement)
packages/insula-mcp/research-based-improvements.md:5:38 - Unknown word (Satisfact)
packages/insula-mcp/research-based-improvements.md:5:48 - Unknown word (Useretrics)
packages/insula-mcp/research-based-improvements.md:6:9 - Unknown word (macadel)
packages/insula-mcp/research-based-improvements.md:6:36 - Unknown word (ality)
packages/insula-mcp/research-based-improvements.md:6:42 - Unknown word (Scorion)
packages/insula-mcp/research-based-improvements.md:7:6 - Unknown word (Quatvalid)
packages/insula-mcp/research-based-improvements.md:7:34 - Unknown word (ianic)
packages/insula-mcp/research-based-improvements.md:7:40 - Unknown word (Compladem)
packages/insula-mcp/research-based-improvements.md:14:4 - Unknown word (integramewo)
packages/insula-mcp/research-based-improvements.md:14:21 - Unknown word (ftent)
packages/insula-mcp/research-based-improvements.md:16:7 - Unknown word (conera)
packages/insula-mcp/research-based-improvements.md:16:27 - Unknown word (validationg)
packages/insula-mcp/research-based-improvements.md:17:5 - Unknown word (checkinceplianrch)
packages/insula-mcp/research-based-improvements.md:17:23 - Unknown word (commic)
packages/insula-mcp/research-based-improvements.md:17:30 - Unknown word (resea)
packages/insula-mcp/research-based-improvements.md:17:35 - Unknown word (Acadetion)
packages/insula-mcp/research-based-improvements.md:18:3 - Unknown word (tion)
packages/insula-mcp/research-based-improvements.md:18:8 - Unknown word (Integrae)
packages/insula-mcp/research-based-improvements.md:18:17 - Unknown word (Valida)
packages/insula-mcp/research-based-improvements.md:18:23 - Unknown word (Licens) fix: (License)
packages/insula-mcp/research-based-improvements.md:20:4 - Unknown word (gies)
packages/insula-mcp/research-based-improvements.md:22:3 - Unknown word (methodolofo)
packages/insula-mcp/research-based-improvements.md:22:24 - Unknown word (tation)
packages/insula-mcp/research-based-improvements.md:22:37 - Unknown word (repuactices)
packages/insula-mcp/research-based-improvements.md:24:3 - Unknown word (prfor)
packages/insula-mcp/research-based-improvements.md:24:20 - Unknown word (analysi)
packages/insula-mcp/research-based-improvements.md:24:28 - Unknown word (Citats)
packages/insula-mcp/research-based-improvements.md:25:3 - Unknown word (approachetationmenplen)
packages/insula-mcp/research-based-improvements.md:25:30 - Unknown word (imvalidatioaper)
packages/insula-mcp/research-based-improvements.md:25:48 - Unknown word (Pegration)
packages/insula-mcp/research-based-improvements.md:26:17 - Unknown word (Semanticon)
packages/insula-mcp/research-based-improvements.md:28:1 - Unknown word (dati)
packages/insula-mcp/research-based-improvements.md:28:6 - Unknown word (vali)
packages/insula-mcp/research-based-improvements.md:28:11 - Unknown word (integritych)
packages/insula-mcp/research-based-improvements.md:28:23 - Unknown word (Resear)
packages/insula-mcp/research-based-improvements.md:29:2 - Unknown word (oringverity)
packages/insula-mcp/research-based-improvements.md:29:14 - Unknown word (scwith)
packages/insula-mcp/research-based-improvements.md:29:21 - Unknown word (setection)
packages/insula-mcp/research-based-improvements.md:29:31 - Unknown word (ttern)
packages/insula-mcp/research-based-improvements.md:30:1 - Unknown word (featurel)
packages/insula-mcp/research-based-improvements.md:30:15 - Unknown word (alnt)
packages/insula-mcp/research-based-improvements.md:30:20 - Unknown word (metricsassessmety)
packages/insula-mcp/research-based-improvements.md:32:3 - Unknown word (Qualiativider)
packages/insula-mcp/research-based-improvements.md:32:17 - Unknown word (Integr)
packages/insula-mcp/research-based-improvements.md:32:24 - Unknown word (Prockbe)
packages/insula-mcp/research-based-improvements.md:34:5 - Unknown word (Viesacticr)
packages/insula-mcp/research-based-improvements.md:34:21 - Unknown word (prsis)
packages/insula-mcp/research-based-improvements.md:34:30 - Unknown word (analyticematterns)
packages/insula-mcp/research-based-improvements.md:36:3 - Unknown word (Thcode)
packages/insula-mcp/research-based-improvements.md:36:17 - Unknown word (ionidateference)
packages/insula-mcp/research-based-improvements.md:37:9 - Unknown word (ressionsging)
packages/insula-mcp/research-based-improvements.md:37:22 - Unknown word (sdebugsis)
packages/insula-mcp/research-based-improvements.md:37:36 - Unknown word (lyextual)
packages/insula-mcp/research-based-improvements.md:37:45 - Unknown word (anan)
packages/insula-mcp/research-based-improvements.md:38:8 - Unknown word (Integratioeridov)
packages/insula-mcp/research-based-improvements.md:40:5 - Unknown word (intration)
packages/insula-mcp/research-based-improvements.md:40:17 - Unknown word (Integcademic)
packages/insula-mcp/research-based-improvements.md:42:4 - Unknown word (onsggestid)
packages/insula-mcp/research-based-improvements.md:42:18 - Unknown word (backetionta)
packages/insula-mcp/research-based-improvements.md:42:38 - Unknown word (cience)
packages/insula-mcp/research-based-improvements.md:42:55 - Unknown word (Evide)
packages/insula-mcp/research-based-improvements.md:44:1 - Unknown word (emic)
packages/insula-mcp/research-based-improvements.md:44:6 - Unknown word (scor)
packages/insula-mcp/research-based-improvements.md:44:16 - Unknown word (acadity)
packages/insula-mcp/research-based-improvements.md:44:27 - Unknown word (Qualiodat)
packages/insula-mcp/research-based-improvements.md:44:40 - Unknown word (Recommenerns)
packages/insula-mcp/research-based-improvements.md:45:2 - Unknown word (pattdatedrch)
packages/insula-mcp/research-based-improvements.md:45:15 - Unknown word (valireseaacy)
packages/insula-mcp/research-based-improvements.md:45:36 - Unknown word (tion)
packages/insula-mcp/research-based-improvements.md:45:41 - Unknown word (Accuretec)
packages/insula-mcp/research-based-improvements.md:47:5 - Unknown word (Dnalysis)
packages/insula-mcp/research-based-improvements.md:47:20 - Unknown word (Practi)
packages/insula-mcp/research-based-improvements.md:49:5 - Unknown word (Bestmentationsked)
packages/insula-mcp/research-based-improvements.md:49:23 - Unknown word (impleation)
packages/insula-mcp/research-based-improvements.md:49:34 - Unknown word (bacitgration)
packages/insula-mcp/research-based-improvements.md:49:50 - Unknown word (Ctech)
packages/insula-mcp/research-based-improvements.md:49:56 - Unknown word (Insear)
packages/insula-mcp/research-based-improvements.md:51:11 - Unknown word (validatiance)
packages/insula-mcp/research-based-improvements.md:51:31 - Unknown word (Complien)
packages/insula-mcp/research-based-improvements.md:52:5 - Unknown word (Licrdstanda)
packages/insula-mcp/research-based-improvements.md:52:35 - Unknown word (coreity)
packages/insula-mcp/research-based-improvements.md:52:43 - Unknown word (Sual)
packages/insula-mcp/research-based-improvements.md:53:2 - Unknown word (ratioenee)
packages/insula-mcp/research-based-improvements.md:55:5 - Unknown word (commendati)
packages/insula-mcp/research-based-improvements.md:55:16 - Unknown word (reedbackrch)
packages/insula-mcp/research-based-improvements.md:55:30 - Unknown word (resean)
packages/insula-mcp/research-based-improvements.md:55:43 - Unknown word (Validatioademic)
packages/insula-mcp/research-based-improvements.md:57:5 - Unknown word (Acehol)
packages/insula-mcp/research-based-improvements.md:57:16 - Unknown word (placomup)
packages/insula-mcp/research-based-improvements.md:57:51 - Unknown word (Solutioons)
packages/insula-mcp/research-based-improvements.md:58:7 - Unknown word (sessiccuracy)
packages/insula-mcp/research-based-improvements.md:58:20 - Unknown word (acroion)
packages/insula-mcp/research-based-improvements.md:58:35 - Unknown word (atext)
packages/insula-mcp/research-based-improvements.md:58:41 - Unknown word (Retent)
packages/insula-mcp/research-based-improvements.md:59:5 - Unknown word (Conng)
packages/insula-mcp/research-based-improvements.md:59:14 - Unknown word (Debue)
packages/insula-mcp/research-based-improvements.md:59:23 - Unknown word (Interac)
packages/insula-mcp/research-based-improvements.md:61:3 - Unknown word (tsprovemened)
packages/insula-mcp/research-based-improvements.md:61:16 - Unknown word (Impect)
packages/insula-mcp/research-based-improvements.md:63:7 - Unknown word (Exstem)
packages/insula-mcp/research-based-improvements.md:65:1 - Unknown word (tion)
packages/insula-mcp/research-based-improvements.md:65:6 - Unknown word (sygesugted)
packages/insula-mcp/research-based-improvements.md:65:19 - Unknown word (supporon)
packages/insula-mcp/research-based-improvements.md:65:28 - Unknown word (citati)
packages/insula-mcp/research-based-improvements.md:66:4 - Unknown word (validationacademiion)
packages/insula-mcp/research-based-improvements.md:66:30 - Unknown word (detectnti)
packages/insula-mcp/research-based-improvements.md:66:55 - Unknown word (Impledations)
packages/insula-mcp/research-based-improvements.md:67:3 - Unknown word (enecomm)
packages/insula-mcp/research-based-improvements.md:67:11 - Unknown word (rbasedce)
packages/insula-mcp/research-based-improvements.md:67:23 - Unknown word (evidendd)
packages/insula-mcp/research-based-improvements.md:67:32 - Unknown word (Contex) fix: (Context)
packages/insula-mcp/research-based-improvements.md:68:4 - Unknown word (Aeckrom)
packages/insula-mcp/research-based-improvements.md:68:21 - Unknown word (fricetity)
packages/insula-mcp/research-based-improvements.md:68:31 - Unknown word (mearch)
packages/insula-mcp/research-based-improvements.md:68:43 - Unknown word (resntegrateks)
packages/insula-mcp/research-based-improvements.md:70:8 - Unknown word (weenalysis)
packages/insula-mcp/research-based-improvements.md:70:19 - Unknown word (ractices)
packages/insula-mcp/research-based-improvements.md:70:28 - Unknown word (Aest)
packages/insula-mcp/research-based-improvements.md:70:44 - Unknown word (Academ)
packages/insula-mcp/research-based-improvements.md:70:54 - Unknown word (Phag)
packages/insula-mcp/research-based-improvements.md:72:5 - Unknown word (backincadeh)
packages/insula-mcp/research-based-improvements.md:72:17 - Unknown word (aent)
packages/insula-mcp/research-based-improvements.md:72:22 - Unknown word (witinemrative)
packages/insula-mcp/research-based-improvements.md:72:36 - Unknown word (refuild)
packages/insula-mcp/research-based-improvements.md:72:48 - Unknown word (Bhecking)
packages/insula-mcp/research-based-improvements.md:73:3 - Unknown word (mpliance)
packages/insula-mcp/research-based-improvements.md:73:12 - Unknown word (ccense)
packages/insula-mcp/research-based-improvements.md:73:22 - Unknown word (lient) fix: (client, clients)
packages/insula-mcp/research-based-improvements.md:73:28 - Unknown word (Implem)
packages/insula-mcp/research-based-improvements.md:74:4 - Unknown word (validationemplatelar)
packages/insula-mcp/research-based-improvements.md:74:25 - Unknown word (tmantic)
packages/insula-mcp/research-based-improvements.md:74:33 - Unknown word (Scho)
packages/insula-mcp/research-based-improvements.md:74:45 - Unknown word (eline)
packages/insula-mcp/research-based-improvements.md:75:4 - Unknown word (pipsessmenasuality)
packages/insula-mcp/research-based-improvements.md:75:30 - Unknown word (qgrate)
packages/insula-mcp/research-based-improvements.md:75:41 - Unknown word (Inte)
packages/insula-mcp/research-based-improvements.md:77:4 - Unknown word (eneration)
packages/insula-mcp/research-based-improvements.md:77:26 - Unknown word (Coderchase)
packages/insula-mcp/research-based-improvements.md:77:40 - Unknown word (Resea)
packages/insula-mcp/research-based-improvements.md:79:5 - Unknown word (Phendations)
packages/insula-mcp/research-based-improvements.md:81:11 - Unknown word (solutience)
packages/insula-mcp/research-based-improvements.md:81:22 - Unknown word (basedidate)
packages/insula-mcp/research-based-improvements.md:81:35 - Unknown word (Creearch)
packages/insula-mcp/research-based-improvements.md:82:21 - Unknown word (Vibeatabasr)
packages/insula-mcp/research-based-improvements.md:82:49 - Unknown word (erroysis)
packages/insula-mcp/research-based-improvements.md:83:3 - Unknown word (naltextual)
packages/insula-mcp/research-based-improvements.md:83:18 - Unknown word (cgration)
packages/insula-mcp/research-based-improvements.md:83:27 - Unknown word (forxt)
packages/insula-mcp/research-based-improvements.md:83:34 - Unknown word (intentedd)
packages/insula-mcp/research-based-improvements.md:83:44 - Unknown word (Coent)
packages/insula-mcp/research-based-improvements.md:84:4 - Unknown word (Agemmanate)
packages/insula-mcp/research-based-improvements.md:84:15 - Unknown word (taional)
packages/insula-mcp/research-based-improvements.md:84:23 - Unknown word (sonversatent)
packages/insula-mcp/research-based-improvements.md:86:4 - Unknown word (Implem)
packages/insula-mcp/research-based-improvements.md:86:44 - Unknown word (Enhan)
packages/insula-mcp/research-based-improvements.md:86:56 - Unknown word (Phlan)
packages/insula-mcp/research-based-improvements.md:88:7 - Unknown word (Plementatio)
packages/insula-mcp/research-based-improvements.md:90:7 - Unknown word (Impeverity)
packages/insula-mcp/research-based-improvements.md:90:18 - Unknown word (tion)
packages/insula-mcp/research-based-improvements.md:90:29 - Unknown word (sicatife)
packages/insula-mcp/research-based-improvements.md:90:38 - Unknown word (idene)
packages/insula-mcp/research-based-improvements.md:90:44 - Unknown word (Codat)
packages/insula-mcp/research-based-improvements.md:92:3 - Unknown word (Duplicty)
packages/insula-mcp/research-based-improvements.md:92:12 - Unknown word (veri)
packages/insula-mcp/research-based-improvements.md:92:17 - Unknown word (semediumtection)
packages/insula-mcp/research-based-improvements.md:92:40 - Unknown word (deerarametg)
packages/insula-mcp/research-based-improvements.md:92:55 - Unknown word (Lonrity)
packages/insula-mcp/research-based-improvements.md:93:3 - Unknown word (veium)
packages/insula-mcp/research-based-improvements.md:93:9 - Unknown word (seedalysis)
packages/insula-mcp/research-based-improvements.md:93:21 - Unknown word (mansting)
packages/insula-mcp/research-based-improvements.md:93:37 - Unknown word (Deepy)
packages/insula-mcp/research-based-improvements.md:94:4 - Unknown word (severitdi)
packages/insula-mcp/research-based-improvements.md:94:14 - Unknown word (meation)
packages/insula-mcp/research-based-improvements.md:94:23 - Unknown word (identificagic)
packages/insula-mcp/research-based-improvements.md:95:4 - Unknown word (verihigh)
packages/insula-mcp/research-based-improvements.md:95:13 - Unknown word (seection)
packages/insula-mcp/research-based-improvements.md:95:23 - Unknown word (etbject)
packages/insula-mcp/research-based-improvements.md:97:9 - Unknown word (Feadetectioned)
packages/insula-mcp/research-based-improvements.md:97:32 - Unknown word (lidatsearch)
packages/insula-mcp/research-based-improvements.md:97:48 - Unknown word (Rementation)
packages/insula-mcp/research-based-improvements.md:97:64 - Unknown word (Implefinitions)
packages/insula-mcp/research-based-improvements.md:98:12 - Unknown word (debe)
packages/insula-mcp/research-based-improvements.md:98:30 - Unknown word (Viarch)
packages/insula-mcp/research-based-improvements.md:98:43 - Unknown word (Rese)
packages/insula-mcp/research-based-improvements.md:99:9 - Unknown word (cademic)
packages/insula-mcp/research-based-improvements.md:99:17 - Unknown word (Backwith)
packages/insula-mcp/research-based-improvements.md:99:39 - Unknown word (Patternnti)
packages/insula-mcp/research-based-improvements.md:101:8 - Unknown word (Atices)
packages/insula-mcp/research-based-improvements.md:103:6 - Unknown word (pracsis)
packages/insula-mcp/research-based-improvements.md:103:18 - Unknown word (trennalyal)
packages/insula-mcp/research-based-improvements.md:103:37 - Unknown word (aempor)
packages/insula-mcp/research-based-improvements.md:104:6 - Unknown word (validationss)
packages/insula-mcp/research-based-improvements.md:104:19 - Unknown word (referenc) fix: (reference)
packages/insula-mcp/research-based-improvements.md:105:4 - Unknown word (endationsted)
packages/insula-mcp/research-based-improvements.md:105:17 - Unknown word (recomm)
packages/insula-mcp/research-based-improvements.md:105:24 - Unknown word (suppor) fix: (support)
packages/insula-mcp/research-based-improvements.md:108:5 - Unknown word (Kestuggeked)
packages/insula-mcp/research-based-improvements.md:108:17 - Unknown word (sbacrch)
packages/insula-mcp/research-based-improvements.md:108:32 - Unknown word (Reseantat)
packages/insula-mcp/research-based-improvements.md:108:45 - Unknown word (Implemeysis)
packages/insula-mcp/research-based-improvements.md:109:3 - Unknown word (analcontextuaxt)
packages/insula-mcp/research-based-improvements.md:109:25 - Unknown word (Conteh)
packages/insula-mcp/research-based-improvements.md:109:32 - Unknown word (Sourc) fix: (Source)
packages/insula-mcp/research-based-improvements.md:109:38 - Unknown word (Researcons)
packages/insula-mcp/research-based-improvements.md:110:4 - Unknown word (ommendatid)
packages/insula-mcp/research-based-improvements.md:110:15 - Unknown word (Recsee)
packages/insula-mcp/research-based-improvements.md:110:24 - Unknown word (Evidenc)
packages/insula-mcp/research-based-improvements.md:112:6 - Unknown word (targ)
packages/insula-mcp/research-based-improvements.md:112:14 - Unknown word (sking)
packages/insula-mcp/research-based-improvements.md:112:21 - Unknown word (liance)
packages/insula-mcp/research-based-improvements.md:112:28 - Unknown word (checal)
packages/insula-mcp/research-based-improvements.md:112:35 - Unknown word (compthicet)
packages/insula-mcp/research-based-improvements.md:114:3 - Unknown word (Escore)
packages/insula-mcp/research-based-improvements.md:114:10 - Unknown word (targ)
packages/insula-mcp/research-based-improvements.md:114:20 - Unknown word (ementrigor)
packages/insula-mcp/research-based-improvements.md:114:31 - Unknown word (enforcal)
packages/insula-mcp/research-based-improvements.md:115:8 - Unknown word (targetation)
packages/insula-mcp/research-based-improvements.md:115:25 - Unknown word (svalidbility)
packages/insula-mcp/research-based-improvements.md:115:39 - Unknown word (Reproducit)
packages/insula-mcp/research-based-improvements.md:116:14 - Unknown word (scorement)
packages/insula-mcp/research-based-improvements.md:117:16 - Unknown word (dards)
packages/insula-mcp/research-based-improvements.md:118:8 - Unknown word (stanew)
packages/insula-mcp/research-based-improvements.md:118:15 - Unknown word (qualit)
packages/insula-mcp/research-based-improvements.md:118:27 - Unknown word (revimentation)
packages/insula-mcp/research-based-improvements.md:119:5 - Unknown word (Implericslity)
packages/insula-mcp/research-based-improvements.md:119:19 - Unknown word (metearch)
packages/insula-mcp/research-based-improvements.md:119:28 - Unknown word (quabe)
packages/insula-mcp/research-based-improvements.md:119:40 - Unknown word (resurce) fix: (resource)
packages/insula-mcp/research-based-improvements.md:119:51 - Unknown word (Virch)
packages/insula-mcp/research-based-improvements.md:119:63 - Unknown word (Reseation)
packages/insula-mcp/research-based-improvements.md:120:1 - Unknown word (ntegra)
packages/insula-mcp/research-based-improvements.md:120:18 - Unknown word (Iemic)
packages/insula-mcp/research-based-improvements.md:120:30 - Unknown word (Acadments)
packages/insula-mcp/research-based-improvements.md:122:1 - Unknown word (nhanceh)
packages/insula-mcp/research-based-improvements.md:122:15 - Unknown word (Esearc)
packages/insula-mcp/research-based-improvements.md:126:1 - Unknown word (enerins)
packages/insula-mcp/research-based-improvements.md:126:14 - Unknown word (gmmendatiotic)
packages/insula-mcp/research-based-improvements.md:126:28 - Unknown word (recotaate)
packages/insula-mcp/research-based-improvements.md:130:1 - Unknown word (mentss)
packages/insula-mcp/research-based-improvements.md:130:8 - Unknown word (Improveces)
packages/insula-mcp/research-based-improvements.md:130:19 - Unknown word (Analysiactiest)
packages/insula-mcp/research-based-improvements.md:134:1 - Unknown word (liacompntegrity)
packages/insula-mcp/research-based-improvements.md:134:17 - Unknown word (ademic)
packages/insula-mcp/research-based-improvements.md:134:24 - Unknown word (igies)
packages/insula-mcp/research-based-improvements.md:136:3 - Unknown word (Acor)
packages/insula-mcp/research-based-improvements.md:136:8 - Unknown word (methodoloe)
packages/insula-mcp/research-based-improvements.md:136:30 - Unknown word (referenc) fix: (reference)
packages/insula-mcp/research-based-improvements.md:137:2 - Unknown word (profor)
packages/insula-mcp/research-based-improvements.md:137:15 - Unknown word (validatiorch)
packages/insula-mcp/research-based-improvements.md:137:28 - Unknown word (pape)
packages/insula-mcp/research-based-improvements.md:138:3 - Unknown word (Resea)
packages/insula-mcp/research-based-improvements.md:139:2 - Unknown word (oveme)
packages/insula-mcp/research-based-improvements.md:139:8 - Unknown word (impr)
packages/insula-mcp/research-based-improvements.md:139:13 - Unknown word (codee)
packages/insula-mcp/research-based-improvements.md:139:19 - Unknown word (baseddencn)
packages/insula-mcp/research-based-improvements.md:139:33 - Unknown word (Eviementatios)
packages/insula-mcp/research-based-improvements.md:140:5 - Unknown word (Impllysince)
packages/insula-mcp/research-based-improvements.md:140:17 - Unknown word (anaeferes)
packages/insula-mcp/research-based-improvements.md:140:27 - Unknown word (rros)
packages/insula-mcp/research-based-improvements.md:140:47 - Unknown word (ursearch)
packages/insula-mcp/research-based-improvements.md:141:2 - Unknown word (Evidencent)
packages/insula-mcp/research-based-improvements.md:141:22 - Unknown word (Refinem)
packages/insula-mcp/research-based-improvements.md:141:33 - Unknown word (Iterat) fix: (Iterate)
packages/insula-mcp/research-based-improvements.md:145:1 - Unknown word (orcemactices)
packages/insula-mcp/research-based-improvements.md:145:14 - Unknown word (enfpric)
packages/insula-mcp/research-based-improvements.md:145:27 - Unknown word (adem)
packages/insula-mcp/research-based-improvements.md:145:35 - Unknown word (Acion)
packages/insula-mcp/research-based-improvements.md:146:1 - Unknown word (integratthodology)
packages/insula-mcp/research-based-improvements.md:146:20 - Unknown word (merch)
packages/insula-mcp/research-based-improvements.md:146:25 - Unknown word (Resea)
packages/insula-mcp/research-based-improvements.md:148:3 - Unknown word (patternsonmentatipleed)
packages/insula-mcp/research-based-improvements.md:148:26 - Unknown word (imation)
packages/insula-mcp/research-based-improvements.md:148:40 - Unknown word (Cittures)
packages/insula-mcp/research-based-improvements.md:149:9 - Unknown word (Feaesearch)
packages/insula-mcp/research-based-improvements.md:150:3 - Unknown word (rreviewedn)
packages/insula-mcp/research-based-improvements.md:150:22 - Unknown word (oplates)
packages/insula-mcp/research-based-improvements.md:150:30 - Unknown word (basn)
packages/insula-mcp/research-based-improvements.md:150:38 - Unknown word (Temtatio)
packages/insula-mcp/research-based-improvements.md:150:46 - Unknown word (Implemenysis)
packages/insula-mcp/research-based-improvements.md:151:5 - Unknown word (analr)
packages/insula-mcp/research-based-improvements.md:151:17 - Unknown word (Scholaantic)
packages/insula-mcp/research-based-improvements.md:152:9 - Unknown word (ormed)
packages/insula-mcp/research-based-improvements.md:154:6 - Unknown word (validationliance)
packages/insula-mcp/research-based-improvements.md:154:23 - Unknown word (compnse)
packages/insula-mcp/research-based-improvements.md:156:29 - Unknown word (ical)
packages/insula-mcp/research-based-improvements.md:156:40 - Unknown word (Statistght)
packages/insula-mcp/research-based-improvements.md:157:8 - Unknown word (weissment)
packages/insula-mcp/research-based-improvements.md:157:19 - Unknown word (lity)
packages/insula-mcp/research-based-improvements.md:157:24 - Unknown word (asseeproducibiight)
packages/insula-mcp/research-based-improvements.md:158:7 - Unknown word (wetion)
packages/insula-mcp/research-based-improvements.md:158:21 - Unknown word (validathodology)
packages/insula-mcp/research-based-improvements.md:159:3 - Unknown word (Mees)
packages/insula-mcp/research-based-improvements.md:160:5 - Unknown word (Keyalidationity)
packages/insula-mcp/research-based-improvements.md:160:28 - Unknown word (qualadecademic)
packages/insula-mcp/research-based-improvements.md:160:43 - Unknown word (grtation)
packages/insula-mcp/research-based-improvements.md:160:58 - Unknown word (Implemen) fix: (Implement)
packages/insula-mcp/research-based-improvements.md:161:3 - Unknown word (smentsesality)
packages/insula-mcp/research-based-improvements.md:161:30 - Unknown word (Vibch)
packages/insula-mcp/research-based-improvements.md:161:45 - Unknown word (esear)
packages/insula-mcp/research-based-improvements.md:162:5 - Unknown word (Rpeline)
packages/insula-mcp/research-based-improvements.md:162:13 - Unknown word (alidation)
packages/insula-mcp/research-based-improvements.md:162:37 - Unknown word (Multments)
packages/insula-mcp/research-based-improvements.md:166:5 - Unknown word (erslaceholdth)
packages/insula-mcp/research-based-improvements.md:166:25 - Unknown word (pwition)
packages/insula-mcp/research-based-improvements.md:166:33 - Unknown word (ased)
packages/insula-mcp/research-based-improvements.md:166:38 - Unknown word (generae)
packages/insula-mcp/research-based-improvements.md:166:47 - Unknown word (Templatrent)
packages/insula-mcp/research-based-improvements.md:166:67 - Unknown word (Curnts)
packages/insula-mcp/research-based-improvements.md:168:5 - Unknown word (provemeeration)
packages/insula-mcp/research-based-improvements.md:168:35 - Unknown word (Codtterns)
packages/insula-mcp/research-based-improvements.md:170:3 - Unknown word (ging)
packages/insula-mcp/research-based-improvements.md:170:11 - Unknown word (debugessfulng)
packages/insula-mcp/research-based-improvements.md:170:37 - Unknown word (Learniesting)
packages/insula-mcp/research-based-improvements.md:172:9 - Unknown word (tgeneratiesis)
packages/insula-mcp/research-based-improvements.md:173:4 - Unknown word (owingarrblem)
packages/insula-mcp/research-based-improvements.md:173:17 - Unknown word (ngressive)
packages/insula-mcp/research-based-improvements.md:175:3 - Unknown word (Proatures)
packages/insula-mcp/research-based-improvements.md:176:13 - Unknown word (refinementgnostitep)
packages/insula-mcp/research-based-improvements.md:176:55 - Unknown word (lemen)
packages/insula-mcp/research-based-improvements.md:176:63 - Unknown word (Impalysis)
packages/insula-mcp/research-based-improvements.md:177:3 - Unknown word (anticext)
packages/insula-mcp/research-based-improvements.md:177:13 - Unknown word (themarce)
packages/insula-mcp/research-based-improvements.md:177:38 - Unknown word (Soug)
packages/insula-mcp/research-based-improvements.md:178:5 - Unknown word (oblem)
packages/insula-mcp/research-based-improvements.md:178:11 - Unknown word (Solvinterative)
packages/insula-mcp/research-based-improvements.md:178:33 - Unknown word (Isues) fix: (Issues)
packages/insula-mcp/research-based-improvements.md:180:3 - Unknown word (omplex)
packages/insula-mcp/research-based-improvements.md:180:14 - Unknown word (crences)
packages/insula-mcp/research-based-improvements.md:180:26 - Unknown word (refeatur)
packages/insula-mcp/research-based-improvements.md:180:40 - Unknown word (Academictions)
packages/insula-mcp/research-based-improvements.md:182:3 - Unknown word (ndaon)
packages/insula-mcp/research-based-improvements.md:182:9 - Unknown word (recommeased)
packages/insula-mcp/research-based-improvements.md:182:21 - Unknown word (soluti)
packages/insula-mcp/research-based-improvements.md:182:41 - Unknown word (fication)
packages/insula-mcp/research-based-improvements.md:183:5 - Unknown word (classibacked)
packages/insula-mcp/research-based-improvements.md:184:7 - Unknown word (Featurh)
packages/insula-mcp/research-based-improvements.md:185:5 - Unknown word (Keesearcg)
packages/insula-mcp/research-based-improvements.md:185:24 - Unknown word (rintion)
packages/insula-mcp/research-based-improvements.md:185:32 - Unknown word (uscognittern)
packages/insula-mcp/research-based-improvements.md:185:53 - Unknown word (ntationmpleme)
packages/insula-mcp/research-based-improvements.md:186:5 - Unknown word (Ietectionern)
packages/insula-mcp/research-based-improvements.md:186:27 - Unknown word (patt)
packages/insula-mcp/research-based-improvements.md:186:39 - Unknown word (Chech) fix: (Check, Czech)
packages/insula-mcp/research-based-improvements.md:187:5 - Unknown word (Researatterns)
packages/insula-mcp/research-based-improvements.md:187:32 - Unknown word (Validaademic)
packages/insula-mcp/research-based-improvements.md:187:46 - Unknown word (Acons)
packages/insula-mcp/research-based-improvements.md:189:6 - Unknown word (oluti)
packages/insula-mcp/research-based-improvements.md:189:16 - Unknown word (andn)
packages/insula-mcp/research-based-improvements.md:189:21 - Unknown word (erroweeing)
packages/insula-mcp/research-based-improvements.md:189:32 - Unknown word (betionship)
packages/insula-mcp/research-based-improvements.md:189:43 - Unknown word (mapp) fix: (map)
packages/insula-mcp/research-based-improvements.md:189:50 - Unknown word (Relattterns)
packages/insula-mcp/research-based-improvements.md:191:5 - Unknown word (paed)
packages/insula-mcp/research-based-improvements.md:191:13 - Unknown word (errneration)
packages/insula-mcp/research-based-improvements.md:191:25 - Unknown word (basquestion)
packages/insula-mcp/research-based-improvements.md:191:50 - Unknown word (Contctions)
packages/insula-mcp/research-based-improvements.md:192:4 - Unknown word (interaugging)
packages/insula-mcp/research-based-improvements.md:192:20 - Unknown word (debmemory)
packages/insula-mcp/research-based-improvements.md:192:30 - Unknown word (acro)
packages/insula-mcp/research-based-improvements.md:193:17 - Unknown word (Kecontext)
packages/insula-mcp/research-based-improvements.md:194:7 - Unknown word (persistegue)
packages/insula-mcp/research-based-improvements.md:194:19 - Unknown word (wilorn)
packages/insula-mcp/research-based-improvements.md:194:36 - Unknown word (tuntation)
packages/insula-mcp/research-based-improvements.md:194:54 - Unknown word (Implities)
packages/insula-mcp/research-based-improvements.md:195:2 - Unknown word (abilcapal)
packages/insula-mcp/research-based-improvements.md:195:21 - Unknown word (ntextu)
packages/insula-mcp/research-based-improvements.md:195:28 - Unknown word (coontext) fix: (context)
packages/insula-mcp/research-based-improvements.md:195:51 - Unknown word (Researt)
packages/insula-mcp/research-based-improvements.md:197:8 - Unknown word (Managemenational)
packages/insula-mcp/research-based-improvements.md:197:25 - Unknown word (Stanvers)
packages/insula-mcp/research-based-improvements.md:197:35 - Unknown word (Conts)
packages/insula-mcp/research-based-improvements.md:199:8 - Unknown word (Enhancemeesearch)
packages/insula-mcp/research-based-improvements.md:201:5 - Unknown word (responseceholith)
packages/insula-mcp/research-based-improvements.md:201:22 - Unknown word (plation)
packages/insula-mcp/research-based-improvements.md:201:30 - Unknown word (wntaic)
packages/insula-mcp/research-based-improvements.md:201:37 - Unknown word (implemet) fix: (implements, implement)
packages/insula-mcp/research-based-improvements.md:203:2 - Unknown word (Improvemeebuggingactive)
packages/insula-mcp/research-based-improvements.md:207:16 - Unknown word (previ)
packages/insula-mcp/research-based-improvements.md:207:26 - Unknown word (theimprovementsiven)
packages/insula-mcp/research-based-improvements.md:207:66 - Unknown word (herdatav)
packages/insula-mcp/research-based-improvements.md:207:76 - Unknown word (Wikin)
packages/insula-mcp/research-based-improvements.md:207:114 - Unknown word (hecke)
packages/insula-mcp/research-based-improvements.md:207:122 - Unknown word (Vibs)
packages/insula-mcp/research-based-improvements.md:207:137 - Unknown word (iderovacademic)
packages/insula-mcp/research-based-improvements.md:207:152 - Unknown word (pris) fix: (prise, prism)
packages/insula-mcp/research-based-improvements.md:207:164 - Unknown word (alys)
packages/insula-mcp/research-based-improvements.md:207:169 - Unknown word (ansed)
packages/insula-mcp/research-based-improvements.md:207:175 - Unknown word (onndings)
packages/insula-mcp/research-based-improvements.md:209:5 - Unknown word (Fiesearcmic)
packages/insula-mcp/research-based-improvements.md:211:4 - Unknown word (atures)
packages/insula-mcp/research-based-improvements.md:213:27 - Unknown word (Improvementsed)
packages/insula-mcp/research-based-improvements.md:213:51 - Unknown word (Resea)
packages/insula-mcp/src/ml/README.md:7:30 - Unknown word (Ollama)
packages/insula-mcp/src/ml/README.md:16:64 - Unknown word (brainwav)
packages/insula-mcp/src/ml/README.md:20:36 - Unknown word (ollama)
packages/insula-mcp/src/ml/README.md:46:5 - Unknown word (Ollama)
packages/insula-mcp/src/ml/README.md:49:61 - Unknown word (Ollama)
packages/insula-mcp/src/ml/README.md:64:23 - Unknown word (ollama)
packages/insula-mcp/src/ml/README.md:76:4 - Unknown word (Ollama)
packages/insula-mcp/src/ml/README.md:77:11 - Unknown word (Ollama)
packages/insula-mcp/src/ml/README.md:152:32 - Unknown word (Inwav)
packages/insula-mcp/src/providers/academic/README.md:3:25 - Unknown word (FASTMCP)
packages/insula-mcp/src/providers/academic/README.md:29:28 - Unknown word (openalex)
packages/insula-mcp/src/providers/academic/README.md:40:4 - Unknown word (openalex)
packages/insula-mcp/src/providers/academic/README.md:41:4 - Unknown word (openalex)
packages/insula-mcp/src/providers/academic/README.md:42:4 - Unknown word (openalex)
packages/insula-mcp/src/providers/academic/README.md:43:4 - Unknown word (openalex)
packages/insula-mcp/src/providers/academic/README.md:48:45 - Unknown word (philippesaade)
packages/insula-mcp/src/providers/academic/README.md:48:59 - Unknown word (wmde)
packages/insula-mcp/src/providers/academic/README.md:52:3 - Unknown word (SPARQL)
packages/insula-mcp/src/providers/academic/README.md:61:13 - Unknown word (sparql)
packages/insula-mcp/src/providers/academic/README.md:61:30 - Unknown word (SPARQL)
packages/insula-mcp/src/providers/academic/README.md:66:47 - Unknown word (blazickjp)
packages/insula-mcp/src/providers/academic/README.md:85:60 - Unknown word (Bhat)
packages/insula-mcp/src/providers/academic/README.md:200:11 - Unknown word (FASTMCP)
packages/insula-mcp/src/providers/academic/README.md:211:4 - Unknown word (FASTMCP)
packages/insula-mcp/src/tools/README.md:184:8 - Unknown word (Inwav)
packages/insula-mcp/src/tools/README.md:186:22 - Unknown word (WCAG)
packages/insula-mcp/src/web/README.md:30:23 - Unknown word (Ollama)
packages/insula-mcp/src/web/README.md:64:3 - Unknown word (WCAG)
packages/insula-mcp/WEB_INTERFACE_IMPLEMENTATION.md:57:26 - Unknown word (Ollama)
packages/insula-mcp/WEB_INTERFACE_IMPLEMENTATION.md:80:3 - Unknown word (WCAG)
packages/insula-mcp/WEB_INTERFACE_IMPLEMENTATION.md:169:14 - Unknown word (Inwav)
packages/insula-mcp/WEB_INTERFACE_IMPLEMENTATION.md:173:3 - Unknown word (WCAG)
README.md:17:24 - Unknown word (WCAG)
README.md:26:17 - Unknown word (brainwav)
README.md:29:6 - Unknown word (brainwav)
README.md:53:5 - Unknown word (Inwav)
README.md:57:56 - Unknown word (arctdd)
README.md:133:5 - Unknown word (Sandboxed)
README.md:136:19 - Unknown word (WCAG)
README.md:179:10 - Unknown word (brainwav)
README.md:229:28 - Unknown word (brainwav)
README.md:236:24 - Unknown word (Inwav)

- ⚠️ .insula/rules/AGENT_CHARTER.md: Contains 3 TODO/FIXME comments
- ⚠️ .insula/rules/RULES_OF_AI.md: Contains 2 TODO/FIXME comments
- ⚠️ .insula/rules/_time-freshness.md: No headings found
- ⚠️ .insula/rules/agentic-coding-workflow.md: Contains 3 TODO/FIXME comments
- ⚠️ .insula/rules/code-review-checklist.md: Contains 3 TODO/FIXME comments
- ⚠️ .insula/rules/constitution.md: Contains 2 TODO/FIXME comments
- ⚠️ .kiro/specs/insula-mcp-diagnostic-system/design.md: Contains 1 TODO/FIXME comments
- ⚠️ CODESTYLE.md: Contains 2 TODO/FIXME comments
- ⚠️ packages/insula-mcp/docs/IDE_INTEGRATION.md: File is empty

## Validation Steps Performed

- [x] File structure validation
- [x] Markdown syntax validation
- [x] Link validation
- [x] Spelling validation
- [x] Cross-reference validation
- [x] Content quality validation
