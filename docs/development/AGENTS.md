<!--
file_path: "AGENTS.md"
description: "Agent Operational Instructions for CortexDx"
maintainer: "@jamiescottcraik"
last_updated: "2025-11-05"
version: "2.0.0"
status: "authoritative"
license: "Apache 2.0"
-->

# AGENTS — CortexDx (authoritative)

**Scope:** This document governs every human and AI contributor working inside the CortexDx repository. The instructions below are mandatory unless a newer project-local `AGENTS.md` overrides a section. Failing to comply blocks merge.

> 📌 **Read this first:** the canonical vision and PRD integration for this project lives at [`/.cortexdx/rules/vision.md`](./.cortexdx/rules/vision.md). Always keep your work aligned with that document.

---

## 0. Snapshot — What You MUST Do Every Time

1. **Embrace ArcTDD** (Red → Green → Refactor). Write or update tests *before* shipping code. Each arc ≤7 steps.
2. **Run Mise + pnpm install** before work (`mise install && pnpm install`). Toolchain versions are pinned.
3. **Use pnpm/Nx/Biome workflows only:**
   - `pnpm lint` → Biome lint (no warnings allowed)
   - `pnpm test` → Vitest + build dependency
   - `pnpm build` → tsup bundle verification
4. **Keep CortexDx stateless & read-only.** Diagnostics must never mutate target MCP servers.
5. **Named exports + ≤40-line functions.** No default exports, no giant functions. Split logic if needed.
6. **Determinism & evidence.** Support `--deterministic`, attach evidence pointers to every finding, and respect OTEL/har settings.
7. **WCAG 2.2 AA compliance.** CLI outputs must be screen-reader friendly (summary-first, no color-only cues).
8. **Security first:** no secrets in logs, HAR redacted, OAuth/headers handled through adapters only.
9. **Before you leave:** run `pnpm lint && pnpm test && pnpm build` and ensure reports make sense against a mock server when practicable.

---

## 1. Hierarchy of Authority

1. **This AGENTS.md** (repo root) — authoritative for CortexDx.
2. **Nested `AGENTS.md` files** — may tighten rules for subdirectories.
3. **Vision Doc** (`.cortexdx/rules/vision.md`) — defines north star, roadmap, and non-goals.
4. **brAInwav Constitution + CODESTYLE** — global policies (branding, a11y, ArcTDD, governance).

Whenever instructions conflict, obey the most specific rule that still honours higher-level mandates.

---

## 2. Toolchain & Local Setup

- **Node:** 20.11.1 (managed by Mise).
- **pnpm:** 9.12.2 (managed by Mise).
- **Nx:** 19.8.4.
- **Biome:** 1.9.4 (lint + format via `pnpm lint` / `pnpm --dir packages/cortexdx exec biome format src`).
- **Typescript/tsup/vitest:** already specified in `packages/cortexdx/package.json`.
- **Secrets:** load the 1Password-managed `.env` (via `op run --env-file=.env -- pnpm …` or equivalent) before running lint/test/build/research commands so Context7, Exa, Vibe Check, OpenAlex, Cloudflare, and LLM adapters have the required API keys.
- **Workflow state DB:** LangGraph checkpoints default to `.cortexdx/workflow-state.db` (override via `CORTEXDX_STATE_DB` or `--state-db`). Treat the SQLite file as sensitive and never commit it.
- **Security automation:** Use the pinned scripts `pnpm security:semgrep`, `pnpm security:gitleaks`, and `pnpm security:zap <endpoint>` whenever security tooling changes; expect JSON output and deterministic exit codes.

```bash
mise install             # installs pinned Node & pnpm
pnpm install             # workspace dependencies
pnpm lint                # Biome lint gate
pnpm test                # Vitest (invokes build first)
pnpm build               # tsup bundle & dts check
```

Never substitute npm/yarn or bypass Nx target wrappers. Do not add global installs.

### Local Memory profile toggle (Cortex ↔ CortexDx)

Many CortexDx diagnostics rely on the Cortex Local Memory stack for Qdrant and
MCP bridge parity. Before running workflows that must mirror Cortex behavior:

1. From the `.Cortex-OS` repo root, run `pnpm mcp:profile cortexdx` (wrapper for
   `scripts/launchd/toggle-local-memory.sh`). This bootouts any existing agent,
   renders the CortexDx plist, and restarts launchd with the MCP-only profile.
2. Verify the swap with `launchctl print gui/$UID/com.brainwav.cortexdx-local-memory
   | rg -i state`, `lsof -i :3002` (should be empty), and `lsof -i :6333`
   (Qdrant stays up for semantic recall).
3. After reproducing/diagnosing, return to the Cortex default via
   `pnpm mcp:profile cortex` and re-check the ports.

Always mention which profile you used in PR evidence so reviewers can copy the
same commands without editing plist files manually.

---

## 3. Development Workflow (ArcTDD in Practice)

1. **Plan:** understand the relevant section in `vision.md`, review the applicable docs (`.cortexdx/rules/vision.md`, `README.md`, and any governed `.cortexdx/library` snapshots), and break work into ≤7 steps. Explicitly note which docs you consulted before locking the plan.
2. **Test first:** add or adjust Vitest suites (`packages/cortexdx/tests`). For new plugins or adapters, include targeted tests plus any necessary mock servers under `scripts/mock-servers/`.
3. **Implement:**
   - Keep functions ≤40 lines; compose helpers if necessary.
   - Maintain named exports (`export const Foo`, `export function`, `export type { ... }`).
   - Avoid `any`. Use explicit types or narrow with guards (Biome enforces this).
   - Ensure sandboxed plugins respect read-only constraints.
4. **Determinism:** if randomness/time is involved, respect the `deterministic` flag. Do not write real-time `Date.now()` results to findings unless seeded or offset aware.
5. **Evidence:** every finding must include at least one evidence pointer (`url`, `file`, or `log`). For new plugin outputs, extend reporting if needed.
6. **Docs & Vision Alignment:** update README/vision when introducing new flags, suites, or governance impacts.
7. **Verify:** run `pnpm lint`, `pnpm test`, and `pnpm build`. When orchestration/LLM/performance code changes, also run `pnpm test:integration` (enables `CORTEXDX_RUN_INTEGRATION=1`) plus `npx cortexdx diagnose` against mock servers (`ok.ts`, `broken-sse.ts`, etc.) and `cortexdx orchestrate --workflow agent.langgraph.baseline <endpoint>` to validate LangGraph orchestration + checkpoint evidence.

---

## 4. MCP-Specific Rules

- **Scope:** CortexDx inspects MCP servers/clients only. Do not expand into generic REST/GraphQL fuzzing without explicit roadmap approval.
- **Statelessness:** No writes, no destructive actions, no persistence beyond local artifacts (`reports/`, HAR). Opt-in HAR must always redact authorization headers.
- **Plugin Sandbox:** all plugins execute inside worker threads with budgets. Never require forbidden modules (`fs`, `child_process`, raw `net`). If a plugin cannot run sandboxed, treat that as a bug and surface a major finding.
- **Transports:** Support HTTP(S), SSE, WebSocket, JSON-RPC (batch & notifications), optional gRPC shim. Streaming probes must honour proxies (retry/ID semantics).
- **Governance Integration:** `.cortex` packs drive policy checks. Any change to governance logic must keep policy-drift detection intact.
- **Observability:** use `withSpan` helper for long-running probes. Tag spans with endpoint, suite, severity, confidence, durations, versions.
- **Accessibility:** CLI messaging must start with severity text (`[BLOCKER]`, `[MAJOR]`, etc.) and avoid color-only differences.

---

## 5. Coding & Formatting Standards

- **Language:** TypeScript ESM (`module` + `moduleResolution` = `NodeNext`).
- **Exports:** Named exports only (no `default`). Type-only exports use `export type { ... }`.
- **Function size:** ≤40 lines. Break helpers when necessary.
- **No implicit `any`.** Use discriminated unions, type guards, or generics.
- **Linting:** `pnpm lint` must pass with zero warnings. Biome controls style, indentation (2 spaces), and forbids unused template literals.
- **Testing:** Vitest tests live in `packages/cortexdx/tests`. Keep them deterministic; employ mocks for network behaviour.
- **File structure:** new suites in `src/plugins/`, adapters under `src/adapters/`, reporting under `src/report/`, workers under `src/workers/`.
- **Docs:** update `README.md` for new commands/flags and cross-reference the vision doc.

---

## 6. CI Expectations

CI (GitHub Actions) will:
- Install via pnpm (respecting provided lockfile).
- `pnpm build`, `pnpm lint`, `pnpm test` (in that order).
- Run `cortexdx diagnose` (quick suite) and upload artifacts.
- Fail the workflow if findings include severity `blocker` (exit 1) or `major` (exit 2) unless overridden by flags.
- Produce SBOM (`npm ls`) and license scans per Constitution/CODESTYLE.

**You are responsible** for keeping workflows green. If CI reveals severity-based failures, adjust tests or plugin logic accordingly.

---

## 7. Security & Compliance

- **Secrets:** never hardcode. Authentication headers must originate from CLI options (`--auth`) or environment variables passed securely. HAR redactor must mask `authorization`, `cookie`, `token`, etc.
- **OAuth Simulations:** ensure device/client credential flows are simulated safely and logged as diagnostics only.
- **Rate Limiting:** plugins testing 429/Ratelimit semantics must respect budgets and avoid DOS behaviour.
- **Static Analysis:** keep Semgrep/OSV/gitleaks configuration in sync with Constitution requirements (run locally when rules change).
- **Legal:** data policy footer remains part of Markdown report. Do not remove or alter branding.

---

## 8. Accessibility & UX

- Severity prefixes (`[BLOCKER]`, `[MAJOR]`, `[MINOR]`, `[INFO]`).
- Provide a summary-first line for screen readers.
- Avoid color-only cues. Use text and icons/ASCII where necessary.
- When adding a TUI (roadmap M3), ensure WCAG 2.2 AA compliance (focus management, landmarks, keyboard control).

---

## Security Policy
- See [SECURITY.md](SECURITY.md) for supported versions, threat model, and reporting instructions.

## 9. Contribution Checklist (pre-PR)

- [ ] Tests written/updated before code.
- [ ] `mise install` + `pnpm install` executed.
- [ ] `pnpm lint` passes (no warnings).
- [ ] `pnpm test` passes (Vitest + build).
- [ ] `pnpm build` passes (tsup + dts).
- [ ] Reports validated against at least one mock server when behavior changes.
- [ ] README/vision/CI docs updated if flags, suites, or behaviours change.
- [ ] Evidence pointers added/updated for new findings.
- [ ] Plugin sandbox and determinism respected.

Attach the summary of these checks to your PR description or review notes.

---

## 10. Non-Negotiables & Non-Goals

- ❌ No default exports.
- ❌ No writing to target servers, no patching remote configs.
- ❌ No global singleton state that survives between runs (stateless only).
- ❌ No introduction of alternative package managers or build tooling.
- ❌ No expansion into non-MCP protocol scanning without product approval.
- ✅ Always cite evidence, respect ArcTDD, uphold branding.

Failure to meet these expectations will block your contribution until corrected.

---

Stay aligned with the vision, keep inscriptions deterministic, and ship evidence-backed diagnostics. ✦


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

<!-- nx configuration end-->
