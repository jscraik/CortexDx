# CODESTYLE.md

## Purpose

This document defines **mandatory coding standards** for the Insula MCP monorepo.  
All contributors and automation agents must follow these rules. CI enforces them via Nx targets and checks (Biome, ESLint **v9 flat config**, Ruff, Pyright, Clippy, pytest, mutation testing, Semgrep, supply-chain scanners).  
**Baselines**: Node **24 Active LTS** (see [ADR 004](./docs/architecture/decisions/004-node-24-active-lts.md)), React **19**, Next.js **15**, Rust **2024 edition** (rustc ≥ **1.85**).

---

## 0. brAInwav Production Standards (Hard Prohibitions)

**ABSOLUTE PROHIBITION** — It is a policy violation to ship or describe anything as “production-ready”, “complete”, “operational”, or “fully implemented” if any of the following exist anywhere in a production code path:

- `Math.random()` (or equivalent) used to fabricate data
- Hard-coded mock responses (e.g., “Mock adapter response”)
- `TODO`/`FIXME`/`HACK` comments in production paths
- Placeholder stubs (e.g., “will be wired later”)
- Disabled features signaling gaps (e.g., `console.warn("not implemented")`)
- Fake metrics or synthetic telemetry presented as real

**Branding & truthfulness**

- **Apps/binaries/infrastructure services** must include **brAInwav** branding in outputs, **error messages**, and **logs**.  
- **Shared libraries** SHOULD avoid hard-coded branding; when emitting logs, prefer a structured field `{ brand: "brAInwav" }` passed/injected by the caller.
- Status claims in UIs, logs, or docs must be **evidence-backed by code** and passing checks.
- The file `.insula/rules/RULES_OF_AI.md` is normative; this document complements it.

**Detection**

- Pattern guards, AST-Grep, Semgrep, and CI checks fail on violations.
- Any new exception requires an ADR and a temporary, time-boxed allowlist entry.

---

## 1. General Principles

- **Functional-first**: Prefer pure, composable functions. Minimize hidden state and side effects.
- **Classes**: Only when required by a framework (e.g., React ErrorBoundary) or to encapsulate unavoidable state.
- **Functions**: ≤ 40 lines; split if readability suffers. Prefer guard clauses over deep nesting.
- **Exports**: Named exports only. No `export default`.
- **ESM everywhere**: JS/TS packages use `"type": "module"`. Avoid CJS.
- **Determinism**: No ambient randomness/time in core logic; inject seeds/clocks.
- **DRY**: Shared logic lives in:

  - `src/lib/` (TypeScript)
  - `apps/insula-py/lib/` (Python)
  - `crates/common/` (Rust)

---

## 2. Monorepo Task Orchestration (Nx “Smart” Mode)
  - `apps/insula-py/lib/` (Python)

- Explicit types at **all public API boundaries** (functions, modules, React props).
- `strict: true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Prefer `unknown` over `any`. Use `satisfies` for object literal constraint checking.

**Modules & imports**

- **ESM only** (`"type": "module"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`).
- **JSON imports** use **import attributes** (Node standard):

  ```ts
  import data from "./foo.json" with { type: "json" };
  ```

- TS compiler options MUST include:
  - `"verbatimModuleSyntax": true` (preserve type-only imports/exports)
  - `"moduleDetection": "force"` (treat files as modules unless proven otherwise)

**Async & cancellation**

- Prefer `async/await`. Avoid deep `.then()` chains.
- Support **cancellation** via `AbortSignal` for all I/O and long-running operations.

**Errors**

- Guard-clause style; propagate context-rich errors (include operation, inputs, correlation id).
- Never swallow errors; route to the logging layer (see §12).

**Style & linting**

- **Biome** is the **formatter** and the default for everyday linting. Do **not** use Prettier.
- **ESLint ≥ 9 (flat config)** is required for **policy/architecture/security** rules (e.g., boundaries, security plugins).  
  Maintain a single `eslint.config.js` per package; avoid duplicate rule coverage with Biome.
- Migrate any legacy `.eslintrc*` to flat config.

**Testing**

- Co-located tests in `__tests__` or `*.test.ts`.
- **Vitest** is the default for browser/RSC/client-side and rich mocking.
- The **Node.js built-in test runner** is allowed for small, pure Node libs (no browser/RSC).
- Snapshots only for intentionally stable serialized outputs (avoid DOM tree snapshots).

**Security**

- No `eval`/dynamic Function. No unpinned remote code. Validate/sanitize all external inputs.

**MLX rule**

- All MLX integrations must be real; no mocks/placeholders in production code.

---

## 3.1. TypeScript Project Configuration (brAInwav Standards)

**Purpose**: Standardized TypeScript configuration across all packages to ensure build consistency, enable incremental compilation, and support project references.

**Templates**: Available in `.insula/templates/tsconfig/`

- `tsconfig.lib.json` - Standard library configuration
- `tsconfig.spec.json` - Test configuration  
- `README.md` - Complete usage documentation

### Required Configuration Fields

All buildable TypeScript packages MUST have:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "dist",
    "noEmit": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": [
    "dist",
    "node_modules",
    "**/*.test.ts",
    "**/*.spec.ts",
    "tests/**/*"
  ]
}
```

### Test Configuration Separation

Packages with test files SHOULD use separate `tsconfig.spec.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist-spec",
    "composite": false,
    "noEmit": true,
    "types": ["vitest/globals", "node"]
  },
  "include": [
    "tests/**/*",
    "src/**/*.test.ts",
    "src/**/*.spec.ts"
  ]
}
```

### rootDir Guidelines

- **Default**: Omit `rootDir` - TypeScript infers correctly.
- **Use ONLY when**: Output structure must match specific entry point expectations.
  - Example: `"start": "node dist/server.js"` requires `"rootDir": "src"`.
- **Never**: Set `rootDir` that conflicts with `include` patterns.

### Creating New Packages

```bash
# 1. Copy template
cp .insula/templates/tsconfig/tsconfig.lib.json packages/my-package/tsconfig.json

# 2. Adjust extends path (match your package depth)
# packages/my-package/ → "../../tsconfig.base.json"
# packages/services/my-package/ → "../../../tsconfig.base.json"

# 3. Add test config if needed
cp .insula/templates/tsconfig/tsconfig.spec.json packages/my-package/

# 4. Verify
cd packages/my-package
pnpm build
pnpm typecheck
```

### Migrating Existing Packages

```bash
# Preview changes
pnpm tsx scripts/migrate-tsconfig.ts --dry-run

# Apply to all packages
pnpm tsx scripts/migrate-tsconfig.ts --apply

# Apply to single package
pnpm tsx scripts/migrate-tsconfig.ts --apply --package packages/my-pkg
```

### Validation

```bash
# Structure validation (includes tsconfig checks)
pnpm structure:validate

# Test Phase 2 compliance
pnpm vitest run tests/scripts/typescript-templates.test.ts
```

### Common Errors & Solutions

See `docs/troubleshooting/typescript-config.md` for:

- TS6059: File not under rootDir
- TS5056: File would be overwritten
- TS6307: File not in project references
- Missing composite flag issues

### Phase Implementation Status

- ✅ Phase 1: Local tsconfig correctness (Complete)
- ✅ Phase 2: Templates & migration (Complete)
- ⬜ Phase 3: Project references (Future - enables cross-package compilation)

---

## 4. React / Next.js

- **Baselines**: **React 19** and **Next.js 15**.
- **Component roles**
  - Containers: fetch, state, mutations.
  - Presentational children: pure and stateless.
  - List containers separate from stateless items; use keys and virtualize when needed.
- **React Server Components (RSC)**
  - Default to **Server Components**. Mark client code with `"use client"`.
  - Use `use server` for server actions. Keep client components thin.
- **Async UI states**
  - Use **Suspense** and **Error Boundaries**. Every async surface must render: Loading, Error (with retry), Empty, Success.
- **Accessibility**
  - WCAG **2.2 AA** baseline.
  - Proper roles/labels for all interactive elements.
  - Full keyboard navigation and visible focus. Never rely on color alone.

---

## 5. Python (uv-managed)

- **Identifiers**: `snake_case` (funcs/vars), `PascalCase` (classes).
- **Types**: Required on all public functions. Enforce with **Pyright** (`strict`).
- **Lint/format**: **Ruff** (`ruff check --fix` + `ruff format`) is mandatory.
- **Packaging**: Each app has `pyproject.toml` and `uv.lock`. Use `uv` for sync/run.
- **Imports**: Absolute imports only.
- **Testing**: `pytest` suite participates in repo quality gates (see §10). Aim for high branch coverage per package; release-readiness gates may require ≥95%.

---

## 6. Rust (TUI/CLI only)

- **Edition**: Pin to **Rust 2024**.
- **Minimum toolchain**: `rustc 1.85.0` (pin via `rust-toolchain.toml`).
- **Style & lints**: `rustfmt` + `cargo clippy -- -D warnings` (CI fails on warnings).
- **Errors**: CLI binaries use `anyhow::Result`; libraries expose structured enums (e.g., `thiserror`).
- **UI**: `ratatui`/`crossterm`. Provide ASCII fallback; never color-only indicators.
- **Modules**: < 500 LOC; extract shared logic into crates.
- **Testing**: Unit tests alongside modules; integration tests under `tests/`.

---

## 7. Naming Conventions

- **Directories & files**: `kebab-case`
- **Variables & functions**: `camelCase` (JS/TS), `snake_case` (Python/Rust)
- **Types & components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

---

## 8. Commit, Releases, ADRs

- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`, etc.).
- **Signing**: All commits/tags are signed (GPG/SSH or Sigstore **Gitsign** in CI).
- **Releases**: SemVer; changelogs generated (Changesets/Nx release).
- **ADRs**: Required for significant decisions; store under `docs/adr/` (MADR template).

---

## 9. Toolchain & Lockfiles

- **Node**: **24 Active LTS** pinned in `.mise.toml` (see [ADR 004](./docs/architecture/decisions/004-node-24-active-lts.md)).
- **Mise** (`.mise.toml`) pins Node, Python, uv, Rust, and other tool versions.
- **Package manager**: **pnpm** (single repo-wide choice).
- **Corepack** manages pnpm version; Bun is not used.
- **Lockfiles**: Only **`pnpm-lock.yaml`** exists in the repo.
- **Frozen installs**
  - Node: `pnpm install --frozen-lockfile`
  - Python: `uv sync --frozen`
  - Rust: `cargo build --locked`

---

## 10. Quality Gates: Coverage, Mutation, TDD

**PR Merge Gate (must pass)**

- Branch coverage ≥ **65%** (`BRANCH_MIN` env override)
- Mutation score ≥ **75%** (`MUTATION_MIN` env override)

**Aspirational baselines (Vitest config)**

- Statements 90% • Branches 90% • Functions 90% • Lines 95%

**Readiness workflows**

- Package-level release readiness may enforce **≥95%** coverage (per workflow policy).

**Mutation testing**

- Use **Stryker** for JS/TS. Enforce `MUTATION_MIN` in CI; produce badges/metrics.

**TDD enforcement**

- Use the **TDD Coach** package:
  - Dev watch for feedback
  - Pre-commit validation for staged files
  - CI status check blocks non-compliant PRs

---

## 11. Automation & Agent-Toolkit (MANDATORY for agents)

- Agents and automation **must** use `packages/agent-toolkit` for:
  - Code search (`multiSearch`) instead of raw `grep/rg`
  - Structural refactors/codemods
  - Cross-language validation and pre-commit checks
- Shell “Just” recipes are canonical entry points:
  - `just scout "<pattern>" <path>`
  - `just codemod 'find(:[x])' 'replace(:[x])' <path>`
  - `just verify changed.txt`
- Architecture: contract-first (Zod), event-driven, MCP compatible, layered design.

---

## 12. Security, Supply Chain & Compliance

- **Dependencies**: Lockfile is the source of truth; no ad-hoc CI upgrades.
- **Secrets**: Never hard-code. Use env injection/secret manager. Prevent client bundle leaks.
- **Scanning per PR**
  - Vulnerabilities: OSV-Scanner, `pnpm audit`, `pip-audit`, `cargo audit`
  - Licenses: ScanCode/ORT (SPDX allowlist)
  - Static analysis: **Semgrep** (OWASP + LLM + project rules)
  - Structural policies: AST-Grep + pattern guard
- **SBOMs**: Generate **CycloneDX** per artifact (containers, packages) at release.
- **Provenance & signing**
  - Produce **SLSA 1.0** provenance (in-toto attestations) for build artifacts.
  - Sign/verify with **Sigstore Cosign**; enforce admission policy where applicable.
  - **GitHub Artifact Attestations** MUST be published and verified for release artifacts.
  - Commits/tags signed (see §8).
- **Containers**
  - Minimal, pinned base images (distroless where possible), non-root, read-only FS, drop caps.

---

## 13. AI/ML Engineering

- **Transparency**
  - Ship a **Model Card** and **Eval report** with each model.
  - Datasets require **Datasheets for Datasets** (lineage, consent, restrictions).

- **Reproducibility**
  - Fixed seeds, hashed datasets, versioned configs, recorded training/inference params.

- **Evaluations**
  - Maintain an eval harness: task metrics, safety/abuse tests, bias probes. Regressions block merges.

- **Governance & compliance**
  - Maintain an AI risk register aligned with **NIST AI RMF** and **ISO/IEC 23894**.
  - Track **AI Management System** controls per **ISO/IEC 42001**.
  - Align with **EU AI Act** timelines (see Appendix A).

- **Privacy**
  - No PII ingestion without legal basis/DPA. Apply minimization and irreversible de-identification where possible.

---

## 14. Governance Lint Policies (Semgrep + ESLint)

| Rule ID | Source | Summary | Charter linkage |
| --- | --- | --- | --- |
| `no-dotenv-in-prod` | `semgrep/brAInwav.yml` | Blocks `dotenv.config()` in prod paths; require shared loader. | Guardrail #9 (preflight secrets) + G4 env discipline |
| `no-console-in-prod` | `semgrep/brAInwav.yml` + ESLint `no-console` override | Forces `traceLogger.log()` with branded payload + `trace_id`. | Guardrail #6 (brand logs) + trace context |
| `no-math-random-in-prod` | `semgrep/brAInwav.yml` | Prevents fabricated data/entropy. | Guardrail #6 & Proof integrity |
| `require-brainwav-brand-in-logs` | `semgrep/brAInwav.yml` | Ensures `{ brand:"brAInwav" }` attached to logs. | Guardrail #6 |
| `async-must-accept-abortsignal` | `semgrep/brAInwav.yml` | Exported async APIs require `AbortSignal`. | Guardrail #7 (Arc Protocol resilience) |
| `strict-boundaries-no-any` | `semgrep/brAInwav.yml` + ESLint `@typescript-eslint/no-explicit-any` | No `any` at public boundaries. | Guardrail #4 (Proof) |
| `max-lines-per-function` | ESLint `max-lines-per-function` | Functions ≤ 40 LOC; split arcs early. | Guardrail #7 |
| `import/no-default-export` | ESLint | Enforces named exports only. | Guardrail #4 (Proof traceability) |
| `no-restricted-imports` | ESLint | Blocks cross-domain imports; require interfaces. | Guardrail #7 |

- **Local reproduction:** `pnpm lint:smart` (ESLint) and `pnpm dlx semgrep --config semgrep/brAInwav.yml`.
- **Waivers:** Submit a Maintainer-approved waiver with rule ID, scope, expiry (≤7 days), and mitigation. Reference waiver in PR body and task manifest.
- **Waiver Activation Rule:** A charter waiver is valid only after the `charter-enforce / danger` job posts ✅ with a link to the `Apply Waiver` workflow run that recorded Maintainer approval.
- **CI integration:** `charter-enforce` runs both tools; any ERROR result blocks merge and triggers `blocked:charter` until resolved.

---

## 14. Accessibility

- **Baseline**: WCAG **2.2 AA**.
- **Keyboard**: Full operation via keyboard; document shortcuts.
- **Screen readers**: Semantic HTML first; ARIA only where necessary.
- **CLI/TUI**: `--plain`/`--no-color` modes for AT compatibility.

---

## 15. Observability, Logging & Streaming

- **OpenTelemetry**: Instrument services/CLIs to emit OTLP **traces, metrics, and logs** (Logs Data Model “stable”). Correlate request IDs end-to-end.
- **brAInwav logging**
  - Structured logs SHOULD include `brand: "brAInwav"` at app/service boundaries; libraries inherit caller context.
  - Log levels: `error`, `warn`, `info`, `debug`, `trace` only.
- **Performance budgets**: Define bundle/time/memory budgets per app. Fail CI if exceeded.
- **Streaming modes (CLI)**
  - Default: token delta streaming to stdout.
  - `--aggregate` for aggregated final output.
  - Force token streaming: `--no-aggregate`.
  - JSON event streaming: `--json` or `--stream-json` (`delta`, `item`, `completed` events).
  - Precedence: **CLI flag > env (`CORTEX_STREAM_MODE`) > config > internal default**.

---

## 16. Resource Management & Memory Discipline

- Respect active mitigations until baseline is declared stable:
  - pnpm: `childConcurrency: 2`, engine pinning, `engineStrict: true`
  - Nx: serialized heavy tasks (`parallel: 1`, `maxParallel: 1`)
  - `.nxignore` reduces watcher churn
- Use `scripts/sample-memory.mjs` to record RSS/heap during heavy ops.
- Before increasing parallelism, run comparative sampler sessions (before/after) and attach results to the PR.

---

## 17. Repository Scripts & Reports

- **Codemap snapshots**
  - `pnpm codemap` runs `scripts/codemap.py` and emits `out/codemap.json` + `out/codemap.md` with **brAInwav-branded** output.
  - Optional tools (`lizard`, `madge`, `depcheck`) annotate results under `analysis` without failing if missing.
  - Scopes: `repo`, `package:<name>`, `app:<name>`, `path:<relative>`.
- **Badges & metrics**
  - Coverage and mutation badges are static SVGs under `reports/badges/`.
  - Inline sparkline is injected between `BRANCH_TREND_INLINE_START/END` markers via `pnpm sparkline:inline`.
  - `reports/badges/metrics.json` carries composite metrics for GitHub Pages or API use.

---

## 18. MCP & External Tools

- MCP adapters and developer helpers must not hard-code user-specific paths.
- Use `tools/mcp/wrap_local_memory.sh` and `tools/mcp/check_mcp_paths.sh` for local reproducibility.
- Expose MCP endpoints via the documented ports/tunnels; health checks must be scriptable.

---

## 19. Config References (Authoritative)

- **Biome**: `.biome.json` (root; packages may extend)
- **ESLint**: `eslint.config.js` (flat config) for policy/security/import-boundaries rules
- **TSConfig**: `tsconfig.base.json` (project references enabled)
- **Python**: `pyproject.toml` + `uv.lock` (Ruff/Pyright config)
- **Rust**: `rustfmt.toml` + Clippy in CI; **rust-toolchain.toml** pins `channel = "1.85.0"`
- **Mise**: `.mise.toml` pins tool versions (Node 24 Active LTS, Python, uv, Rust; per [ADR-004](./docs/architecture/decisions/004-node-24-active-lts.md))
- **CI**: `.github/workflows/*.yml` enforce gates (quality, security, supply chain, badges)
- **ADRs**: `docs/adr/` (MADR template)
- **brAInwav Rules**: `.insula/rules/RULES_OF_AI.md` (primary production standards)

---

## Appendix A — EU AI Act (dates for governance)

- **Act in force**: 1 Aug 2024
- **GPAI/foundation-model obligations applicable**: **2 Aug 2025**
- **Most provisions fully applicable**: 2 Aug 2026
- **GPAI Code of Practice**: 10 Jul 2025 (voluntary; treated as best practice here)

---

## Appendix B — Policy Automation (Semgrep & ESLint)

- **Semgrep rule catalog**: See `semgrep/brAInwav.yml` (rules defined in [`security/semgrep/packs/brainwav-custom.yml`](security/semgrep/packs/brainwav-custom.yml)). These rules block `child_process.exec*` shell spawns, `NODE_TLS_REJECT_UNAUTHORIZED=0`, and AbortSignal gaps via `brainwav.async.fetch-missing-abort-signal`, `brainwav.async.fetch-options-missing-abort-signal`, `brainwav.async.axios-missing-cancellation`, and `brainwav.async.axios-options-missing-cancellation`.
- **Testing/validation**: Regression tests live in [`security/semgrep/tests/abort-signal`](security/semgrep/tests/abort-signal) and run with `semgrep --test security/semgrep/packs/brainwav-custom.yml`.
- **Exemption criteria**: Helper factories that already inject `signal` are exempt because the rules only match object literals.
- **Waiver process**: Request waivers via `/.insula/waivers/` with Maintainer approval.
- **Legacy ESLint profile** — [`.eslintrc.cjs`](./.eslintrc.cjs) enforces the 40-line ceiling (`max-lines-per-function`), naming conventions, and cross-domain import guards; overrides live in per-package `eslint.config.js` fragments and require a documented waiver before relaxing.
- **Flat ESLint config** — [`eslint.config.js`](./eslint.config.js) layers SonarJS + `typescript-eslint` async safety checks; together with the `AbortSignal` mandate in §3 and the `scripts/ensure-eslint-flat-config.mjs` guard (runs before `pnpm lint:smart` and emits `reports/policy/flat-config-guard.json`), this is how CI verifies cancellation-ready async boundaries. Adjustments also flow through the waiver process above.
