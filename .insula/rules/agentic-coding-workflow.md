# Agentic Coding Workflow — v2025.11+ArcTDD (Tiered, Accessibility Edition)

**Status:** Authoritative  
**Scope:** All human and AI agent activity across Insula MCP  
**Inheritance:** Governance Pack (`/.insula/rules/*`) · `CODESTYLE.md` · Constitution  
**Enforcement:** CI blocks merges if required evidence, guards, branding logs, or arc limits are missing.  
**Accessibility Note:** This document avoids emoji in headings and list markers for screen-reader clarity.

---

## 0) Task Spine and Ground Rules

- **Discrete tasks:** Each feature or fix lives in `~/tasks/<slug>/`.
- **Artifacts at every gate:** specs, plans, tests, evidence, run manifests.
- **Tiny, verifiable steps:** TDD (red → green → refactor), frequent Conventional Commits, atomic PRs.
- **Truthfulness:** No stubs, mocks, or recorded outputs in production paths.
- **A11y and Security:** WCAG 2.2 AA baseline (ISO/IEC 40500:2025); Semgrep, OSV, gitleaks scans gate merges.
- **Branding:** All logs/errors must include `[brAInwav]` and `brand:"brAInwav"`.

---

## 0.1 Preflight Guards and Governance Hooks (mandatory)

- **Time Freshness Guard** — Anchor to harness timezone/date; convert relative dates to ISO-8601 in specs and PRs.
- **Academic Research Enhancement** — Before vibe check, enhance all implementation plans with academic research and validate licenses by using Insula’s built-in academic MCP providers (Wikidata, arXiv, Semantic Scholar, OpenAlex, Context7, EXA, and Vibe Check). Call the tools defined in `packages/insula-mcp/src/tools/academic-integration-tools.ts` (e.g., `validate_architecture_academic`, `validate_research_methodology`, `perform_vibe_check`) through your MCP client or the Insula CLI, capture the full JSON-RPC transcripts, and store them under `~/.insula-mcp/tasks/<slug>/logs/academic-research/`. Research findings MUST be merged back into the plan with citations, and the compliance monitor output must prove that only SAFE/REVIEW sources were used. See `/.insula/rules/vibe-check.md` §2.1 for required evidence keys.
- **Vibe Check MCP (Oversight)** — After the academic suite is complete (and before touching the repo), invoke the bundled `vibe-check` MCP provider (tools `vibe_check` / `vibe_learn`) and archive the response under `logs/vibe-check/<task>.json`. The request must include the latest goal + ≤7 step plan, plus the academic evidence identifiers, and the stored response must show the provider’s approval. JSON-RPC samples and required metadata are documented in `/.insula/rules/vibe-check.md`; missing or stale artifacts keep the PR blocked.
- **Local Memory Parity** — Append key decisions to `.github/instructions/memories.instructions.md` and persist via Local Memory MCP/REST.
- **Knowledge Connectors Live-Check** — Verify `${WIKIDATA_MCP_URL:-http://127.0.0.1:3029}/health` and `${ARXIV_MCP_URL:-http://127.0.0.1:3041}/health`. Store timestamps/responses in `research/connectors-health.log`. Planning is blocked if down, except where tier-based cached health fallback is permitted (see "Toolchain Resilience", lines 281–283).
- **Academic Connector Health** — Verify all academic research endpoints are healthy before research enhancement:

  ```bash
  # Verify MCP-based academic connectors
  curl -s ${WIKIDATA_MCP_URL:-http://127.0.0.1:3029}/health
  curl -s ${ARXIV_MCP_URL:-http://127.0.0.1:3041}/health
  curl -s ${SEMANTIC_SCHOLAR_API_URL:-https://api.semanticscholar.org}/graph/v1/paper/search?query=test
  curl -s ${OPENALEX_API_URL:-https://api.openalex.org}/works?search=test
  ```

- **Secrets via 1Password CLI** — Fetch with `op`; never persist secrets in repo or long-lived env vars.
- **Hybrid Model Live-Only Rule** — Embeddings, rerankers, generations must use live engines (MLX, Ollama, Frontier). No stubs, dry-runs, or recorded outputs.

  ```bash
  pnpm models:health && pnpm models:smoke   # attach model IDs, vector shapes, latency
  ```

- **Plan Step Limit** — Any plan shown to a model must be ≤ 7 concrete steps; split excess into new arcs.

  - Scaffold compliant manifests with `pnpm arc:new --slug <arc-slug> --title "<Arc Title>" [--steps 1-7]`.
  - Use `--inherit-plan` to pull unfinished checklist items from the parent arc when you split work; reviewers expect inherited tasks to appear at the top of the new phase templates.
  - Use `--preview` (or `--dry-run` for metadata only) during design reviews to print the manifest/phase diff without touching disk.
  - When refactors overflow, chain follow-on arcs explicitly: `pnpm arc:new --slug <arc-slug>-2 --title "<Arc Title> (Arc 2)" --parent <arc-slug>` (repeat for Arc 3 as needed). The scaffolder now updates the parent `arc-manifest.json` with `metadata.childArcs` automatically (see `packages/agents/__tests__/scripts/arc-new.spec.ts`).
  - Validate local edits with `pnpm arc:lint` (blocks any manifest where `metadata.stepBudget > 7`) and, when integrating tooling, load the schema at `packages/agents/contracts/arc-manifest.schema.json` (`$id` `https://insula.dev/schemas/arc-manifest.schema.json`).

- **State Recap Rule** — After every 400–700 generated tokens, append a one-line recap to `evidence/recaps.log`: green tests, pending tests, next step.
- **Trace Context Preflight** — Before pushing code, run `pnpm tsx scripts/ci/verify-trace-context.ts <logfile>` on representative logs; failures block commit. Every log line MUST include a W3C Trace Context `trace_id` (32 lowercase hex) propagated from OpenTelemetry.
- **Supply-Chain Evidence** — Generate and attest SBOMs locally: `pnpm sbom:generate && pnpm attest:sign && pnpm verify:attest && pnpm sbom:scan`. Store SBOM + Cosign bundle in `sbom/` and link evidence in the PR checklist.
- **Identity Gate** — CI workflows and long-lived services MUST authenticate via GitHub Actions OIDC/WIF (AWS/Azure/GCP) rather than static credentials. Document provider role bindings in `docs/security/supply-chain.md`.

⸻

### 0.2 Session Hygiene (mandatory)

- **Cadence:** 50 minutes build / 10 minutes reset. At reset, snapshot `run-manifest.json` and start a fresh session.
- **Context Diet:** Last 2 plan bullets + current failing test + current file + manifest summary only.
- **Hard Reset Triggers:** (a) 2 off-spec suggestions in a row; (b) ≥3 speculative edits without tests; (c) proposes renaming core interfaces mid-arc.
- **Charter Reference:** See Charter Guardrail #10 (Session Hygiene) for enforcement requirements.
- **Recap Discipline** (Charter Guardrail #5): Generate recaps after every 400–700 tokens of output, ensuring each recap ≤ 500 tokens. Write to `evidence/recaps.log`: green tests, pending tests, next step.

⸻

### 0.3 Workflow Tiers (choose one per task)

Use the smallest tier that fits. CI enforces tier contracts.

| Tier | When to use | Required Gates | Required Artifacts (minimum) |
| --- | --- | --- | --- |
| Tier 1: fix | Small bug fixes, no contract change | G0, G0.1, G0.2, G1 (North-Star only), G2 (≤7 steps), G3, G4, G5–G7, G10 | `tests/acceptance/<slug>.spec.*`, `implementation-plan.md` (≤7 steps), Evidence Triplet for changed area |
| Tier 2: feature | New capability or contract addition | Full G0–G10 | All artifacts in this workflow |
| Tier 3: refactor | Internal change without public contract change | G0, G0.1, G0.2, G1 (no external research), G2 (≤7 steps), G3, G4, G5–G7, G9, G10 | Contract snapshots (before/after), perf/coverage deltas, Evidence Triplet |

Select tier at task creation; it is recorded in `run-manifest.json`.

⸻

### G0 Initialize

- Create `~/tasks/<slug>/{notes.md, implementation-plan.md, risks.md, decisions.md, evidence/}`.
- Define scope and “done”; write `json/baton.v1.json` including the selected tier.
- Evidence: `notes.md`, `json/baton.v1.json`.

⸻

### G1 Research (Evidence Discovery and North-Star)

- **North-Star first** (Charter Guardrail #8): one-sentence goal plus one acceptance test that proves the feature is real.
  - Path: `tests/acceptance/<slug>.spec.[ts|js|py|http]` (Gherkin or HTTP contract acceptable).
- Semantic code search and reuse analysis.
- **Reuse-first clause:**  
  - Use the semantic search results above to adapt existing implementations, tests, or contracts before proposing new ones.  
  - Document candidate assets in `research/findings.md`.  
  - Map candidate assets to planned steps.  
  - Keep each arc's ≤7-step plan budget.  
  - If reuse work would overflow the step budget, spawn additional arcs and record the reason.
- **Reuse candidate catalog:** After every semantic query, append rows to `research/findings.md` capturing the following fields:
  - `candidate_id`
  - source path/commit
  - deep link
  - mapped plan step
  - feasibility (H/M/L)
  - expected delta scope
  - blockers
  - replay commands
  - Store raw query transcripts under `research/queries/<timestamp>.log` and cross-link them from the table so reviewers can reproduce the search.
- **Plan alignment:** Mirror the `candidate_id` values inside `implementation-plan.md` (e.g., `Step 3 — Adapt cache warm path [reuse:R-018]`) to prove each ≤7-step arc budgets reuse work explicitly. When adaptation would exceed the step ceiling, spawn a follow-on arc, record the overflow reason in `run-manifest.json.arcs[].plan_overflow`, and link to the supporting findings entry.
- **Reviewer pointers:** Reserve a "Reuse Evidence" block in `review.md` listing each `candidate_id` → plan step → manifest arc tuple so reviewers can trace diligence without rehydrating the whole workspace.
- For Tier 2 only: fetch authoritative knowledge via `executeWikidataWorkflow`, `arxiv_search`; store full JSON (QIDs/ArXiv IDs) in `research/`.
- RAID analysis; time-boxed feasibility spikes with results.
- **Clarifying Questions** (Charter Guardrail #2): Agents MAY ask at most three clarifying questions before proceeding, each with concrete options and consequences.
- Evidence: `research/*.json` (Tier 2), `raid.md`, `findings.md`, acceptance test path.

⸻

### G2 Planning (PRP and Arc Protocol)

- **Arc Protocol** (Charter Guardrail #7):
  - Vertical slice (API → logic → store → tests), 2–5 commits, 45–120 minutes end-to-end.
  - Plan ≤ 7 steps per arc (Charter Guardrail #1); overflow becomes a new arc.
  - Contract Freeze per arc (types/schema/route) plus contract test oracle.
- **Failed reuse escalation:** When the reuse-first clause concludes no viable adaptation, upgrade the task to Tier 3 before writing new code and capture the full evidence chain:
  - Store the failing North-Star run (logs + exit status) under `evidence/north-star/<timestamp>.log`.
  - Archive each adaptation spike (branch diff, spike script, or prototype) in `research/findings.md` or `experiments/<slug>/` with outcome notes and direct links to failing assertions or metrics.
  - Snapshot contracts before/after in `design/contracts/<slug>/<timestamp>-{before,after}.json`.
  - Record blocker analysis and mitigations in `decisions.md` referencing the affected `candidate_id`.
  - Update `run-manifest.json` with `tier:"refactor"`, `tier_change.reason`, reviewer notified timestamp, and pointers to stored artefacts.
- Produce `implementation-plan.md` (≤ 7 steps per arc), `srs.md`, and design diagrams (Tier 2).
- Define quality gates (coverage, mutation, a11y, security, performance).
- Plan PR attachments: vibe-check logs, coverage/mutation reports, code-review checklist, models health/smoke logs, a11y/security reports.
- Evidence: `implementation-plan.md`, `srs.md`, and `design/*` (Tier 2).

⸻

### G3 Scaffolding (TDD/BDD Setup)

- Write failing unit and integration tests for each contract; scaffold the Milestone Test for the current arc (must fail first).
  - Extend an existing suite before adding a new helper-specific test file; only create a new suite when the **Reuse Investigation** records why no existing suite can express the failure.
  - Log the first failing test path under `reuseEvidence.failingTest` in `run-manifest.json`; update `reuseEvidence.passingTest` when it turns green and mutation proof is attached.
- Add feature flags (off by default).
- Wire CI stubs: build, test, lint, typecheck.
- Commands:

  ```bash
  pnpm test:smart
  pnpm lint:smart
  pnpm typecheck:smart
  ```

- Evidence: green CI for scaffolds; failing tests show gaps; contract snapshot in `design/contracts/`.

⸻

### G4 Implementation (Execution)

- Micro-loop budget: ≤ 20 minutes or ≤ 3 commits per red → green → refactor loop.
- Tracer-bullet switch: if sequencing unclear after 2 minutes, ship a minimal end-to-end path, then scale with follow-on arcs without changing the public contract.
- Hard rules: named exports only; ≤ 40 lines per function; strict types at boundaries; no `any` in production; async/await with `AbortSignal`; never swallow errors; inject seeds/clocks; no cross-domain imports (use declared interfaces); prohibited: `Math.random()` in prod, placeholder adapters, `TODO`/`FIXME`/`HACK` in prod, console stubs, fake telemetry.
- Enforcement evidence: `semgrep/brAInwav.yml` (wrapping [`security/semgrep/packs/brainwav-custom.yml`](../../security/semgrep/packs/brainwav-custom.yml)) blocks unsafe shells (`child_process.exec*`), TLS downgrades (`NODE_TLS_REJECT_UNAUTHORIZED=0`), and now flags `fetch` + `axios` calls missing cancellation (`brainwav.async.fetch-missing-abort-signal`, `brainwav.async.fetch-options-missing-abort-signal`, `brainwav.async.axios-missing-cancellation`, `brainwav.async.axios-options-missing-cancellation`). `.eslintrc.cjs` keeps `max-lines-per-function` at 40 lines while the root `eslint.config.js` layers SonarJS/TypeScript async checks, with `scripts/ensure-eslint-flat-config.mjs` emitting `reports/policy/flat-config-guard.json` so CI proves cancellation boundaries remain cancellable.
- Security and supply chain: Semgrep (block ERROR), gitleaks (block ANY), OSV clean, CycloneDX SBOM, SLSA/in-toto attestations.
- Env and config: shared loader (`@insula-mcp/utils`); never call `dotenv.config()`.
- Observability: structured logs with `brand:"brAInwav"`, request/run IDs, OTel traces, and `trace_id` sourced via `packages/observability/src/traceLogger.ts`.
- **Exception handling:** Waivers or deviations from the reuse-first or escalation rules must reference the forthcoming reuse-exception and tier-escalation checklist items in `/.insula/rules/code-review-checklist.md` once they land; reviewers are responsible for citing those checklist entries in `review.md` alongside supporting evidence before approving.
- Evidence: incremental passing tests; commit history mapped to arc steps.

⸻

### G5 Verification (Local Gates)

- Thresholds: coverage ≥ 90% global; ≥ 95% changed lines; mutation ≥ 90% (where enabled).
- Security scans: `pnpm security:scan`, Semgrep, OSV, gitleaks.
- Structure and A11y: `pnpm structure:validate`; attach axe/jest-axe reports.
- **Hybrid Model Health** (Charter Guardrail #9): `pnpm models:health && pnpm models:smoke` with model IDs, vector norms/shapes, latency.
- Property and mutation tests for invariants once an arc stabilizes.
- **TDD plan reuse ledger** — Implementation plan MUST surface a `### Reuse Ledger` section (see [§ TDD Plan Reuse Ledger](#tdd-plan-reuse-ledger-g5-evidence-hook)) enumerating reused modules/tests and justification for any rewrites. Link this anchor in `run-manifest.json.evidence.tdd_plan_reuse_ledger` and in the code-review checklist boxes **Reuse existing code** and **Design artefacts present** so reviewers have a direct pointer.
- **Evidence Triplet** (Charter Guardrail #4, per stage):
  1. Milestone Test (red → green proof)
  2. Contract Snapshot (schema/types/route)
  3. Reviewer JSON pointer
  Missing any item fails the stage.
- **Reuse Evidence (NEW charter binding):**
  - `run-manifest.json.reuseEvidence` populated with `plan`, `failingTest`, `passingTest`, and `reviewComment` pointers.
  - Verification report includes benchmark deltas comparing the reused path vs new helper (`reports/perf/<slug>.md`) when helpers are introduced.
  - Attach links to Semgrep/gitleaks/OSV outputs covering both the original module and any new helper when security boundaries are affected.
- **Vibe-check evidence** (Charter Guardrail #9): `logs/vibe-check/<task>.json` present.
- Evidence: `verification/` reports, triplets, model health logs, `implementation-plan.md#reuse-ledger` export.

#### TDD Plan Reuse Ledger (G5 Evidence Hook)

- **Location:** `~/tasks/<slug>/implementation-plan.md#reuse-ledger` (templated in `/.insula/templates/tdd-plan-template.md`). Use a level-three heading exactly matching `### Reuse Ledger` to keep parser hooks stable.
- **Entry contract:** For every reused module, function, contract, or test harness record the repository-relative path, the reuse mode (`as-is`, `adapted`, or `referenced-pattern`), and a concise rationale. Attach the inherited test filenames/IDs and describe any delta coverage or new assertions that guard the reuse. When reuse is not possible, add an explicit "No reuse" entry that explains the blocker, risk, and compensating controls so reviewers do not need to diff the entire plan.
- **Additional context:** Capture performance, security, and compliance implications (for example, prior Semgrep/gitleaks posture, latency budgets already met, feature-flag state) and note any follow-up remediation for partial reuse. Call out borrowed artefacts that live behind toggles or require future clean-up to keep audits deterministic.
- **Evidence pointers:** Populate `run-manifest.json.evidence.tdd_plan_reuse_ledger` with the relative path to this anchor and mirror that pointer in `.insula/evidence-index.json` for audit parity. Include the same URL in the reviewer checklist boxes **Reuse existing code** and **Design artefacts present**.
- **Charter job signal:** The `charter` CI job emits `evidence.tdd_plan_reuse_ledger` inside `quality-report.json`; reviewers MUST confirm that pointer resolves to the ledger before approving reuse waivers or rewrites. A missing or mismatched pointer appears as an enforcement finding in `quality-summary.json`. If the job is unavailable, fall back to manually opening `run-manifest.json.evidence.tdd_plan_reuse_ledger` and linking a local `quality-report.json` capture in the PR.
- **Automation interoperability:** PRP Runner treats `evidence.tdd_plan_reuse_ledger` as an additive field alongside `tdd_plan_md`; downstream automation MAY validate the ledger by resolving the anchor. Keep pointer naming stable (`tdd_plan_*`) to remain backward compatible with existing manifest builders.
- **Failure mode:** Missing ledger pointer, anchors that do not end in `#reuse-ledger`, or stale/no-op entries trigger a `charter` job finding once `scripts/ci/enforce-gates.mjs` validates the manifest.

⸻

### G6 Review (Human-in-the-Loop and Automated)

- Human review: complete `/.insula/rules/code-review-checklist.md`; paste filled copy as a top-level PR comment with evidence pointers (file:line, URLs).
- Reviewers MUST confirm the checklist `Reuse evidence present` and `Helper performance/security deltas` entries are linked to the TDD plan **Reuse Investigation** and verification benchmarks. Record the reviewer comment URL under `run-manifest.json.reuseEvidence.reviewComment`.
- Automated review: run Reviewer Neuron (read-only) to emit machine-checkable JSON findings.
- Policy: BLOCKER must pass; MAJOR requires fix or waiver; MINOR yields a follow-up task.
- **Waiver Policy** (Charter lines 115–124): Waivers require Maintainer approval under `/.insula/waivers/`; must document justification, compensation controls, expiration (≤ 30 days), and remediation plan.
- **Waiver Activation Rule:** A charter waiver is valid only after the `charter-enforce / danger` job posts ✅ with a link to the `Apply Waiver` workflow run that recorded Maintainer approval.
- **Reuse checklist matrix:**
  1. Maintain `review.md#reuse-evidence` with a table mapping each reuse-exception checklist item ID to:
     - Evidence file/line
     - Reviewer verification status
  2. Reference the same IDs in the top-level PR checklist comment so auditors can quickly diff checkboxes against artefacts.
- **Comment cross-links:** Use saved replies in the PR template to point reviewers from reuse checklist items to `research/findings.md`, `implementation-plan.md`, `run-manifest.json`, and `decisions.md`. Missing cross-links block approval.
- **Reviewer sign-off trail:** Append a "Reviewer Acknowledgements" section to `decisions.md` noting reviewer handle, checklist version, artefact hashes, and approval timestamp; update after every review round.
- Checks: plan step count ≤ 7; session resets logged in `run-manifest.json`; recaps in `evidence/recaps.log`.
- Confirm the code-review checklist boxes **Reuse existing code** and **Design artefacts present** link to the [TDD Plan Reuse Ledger](#tdd-plan-reuse-ledger-g5-evidence-hook); missing links are a BLOCKER for G6 sign-off.
- Evidence: `review.md` (merged results), reviewer JSON, `decisions.md`.

⸻

### G7 CI Gates and Artifact Signing

**Workflow Definition:** [`charter-enforce`](../../.github/workflows/pr-quality-gates.yml) orchestrates the ArcTDD charter gates end-to-end.

- **`charter` job** — Verifies ArcTDD guardrails, narrated plan limits, and trace context propagation by running [`scripts/ci/enforce-gates.mjs`](../../scripts/ci/enforce-gates.mjs) + [`scripts/ci/quality-gate-enforcer.ts`](../../scripts/ci/quality-gate-enforcer.ts) against the OPA bundle mirrored in [`packages/security/src/policy-engine/opa`](../../packages/security/src/policy-engine/opa), then confirms log propagation via [`scripts/ci/verify-trace-context.ts`](../../scripts/ci/verify-trace-context.ts).
- **Changeset rehearsal:** The `✅ PR Validation` job runs `pnpm dlx @changesets/cli status --since origin/<base>` and fails when no unreleased changesets exist without the `skip-release` label. Treat `skip-release` as a docs/meta exception only and log the waiver under `/.insula/waivers/` referencing `release.changeset.required` before review.
- **Reuse audit hook:** `scripts/ci/enforce-gates.mjs` reads `run-manifest.json.reuseEvidence` to ensure `plan`, `failingTest`, `passingTest`, and `reviewComment` pointers are non-empty when helpers appear in the diff; violations block the charter job unless a waiver is attached.
- **`test` job** — Enforces coverage ≥ charter thresholds via [`scripts/ci/coverage.sh`](../../scripts/ci/coverage.sh), persists `coverage-results.json`, and publishes HTML deltas with [`scripts/ci/summarize-coverage.mjs`](../../scripts/ci/summarize-coverage.mjs).
- **`mutation` job** — Drives Stryker to ≥ 90% mutation score through [`scripts/ci/mutation.sh`](../../scripts/ci/mutation.sh); forwards `mutation-results.json` + `reports/mutation/` to the quality gate enforcer.
- **`a11y` job** — Executes `pnpm test:a11y` for affected surfaces, consolidates axe/jest-axe violations, and validates documentation parity through [`tools/validators/axe-docs-check.ts`](../../tools/validators/axe-docs-check.ts).
- **`security` job** — Runs [`scripts/ci/security-scan.sh`](../../scripts/ci/security-scan.sh), evaluates OPA policies, produces CycloneDX SBOMs via `pnpm sbom:generate`, and signs provenance bundles with Cosign using the Semgrep profile [`security/semgrep/packs/brainwav-custom.yml`](../../security/semgrep/packs/brainwav-custom.yml) (exported as `semgrep/brAInwav.yml`).
- **`danger` job** — Asserts narrated diffs by invoking [`scripts/narrated-diff.ts`](../../scripts/narrated-diff.ts), enforces PR hygiene, and blocks merge until the narrated diff table is acknowledged in review.
- **Plan reuse audit** — The `charter` job surfaces `evidence.tdd_plan_reuse_ledger` inside `quality-report.json`; reviewers must confirm the pointer resolves to `implementation-plan.md#reuse-ledger` before approving reuse waivers or new work.

| Job        | Coverage ≥90% | Mutation ≥90% | Narrated Diff | Trace Context | SBOM Provenance | Failure Evidence |
| ---------- | ------------- | ------------- | ------------- | ------------- | --------------- | ---------------- |
| `charter`  | –             | –             | –             | ✅ Verified via `verify-trace-context.ts` | –               | Artifacts → charter-gate-${run} (quality-report.json, quality-summary.json, trace-context.log) |
| `test`     | ✅ `coverage.sh` thresholds | – | – | – | – | Artifacts → coverage-html-${run} (lcov-report/) + coverage-results.json |
| `mutation` | – | ✅ Stryker enforcement | – | – | – | Artifacts → mutation-report-${run} (reports/mutation/, mutation-results.json) |
| `a11y`     | – | – | – | – | – | Artifacts → a11y-audit-${run} (axe-summary.json, screenshots/) |
| `security` | – | – | – | – | ✅ SBOM + SLSA attestation | Artifacts → security-scan-${run} (sbom.cdx.json, cosign-bundle.sig, semgrep/brAInwav.sarif) |
| `danger`   | – | – | ✅ Narrated diff table required | – | – | PR comment → narrated diff summary (export via `scripts/narrated-diff.ts --out reports/narrated-diff.md`) |

**Failure evidence retrieval:**

1. Navigate to **Actions → charter-enforce → Run → Artifacts** and download the job-specific bundle (names listed in the table above); the charter bundle contains `quality-report.json`, `quality-summary.json`, and `trace-context.log` for waivers and audits.
2. For narrated diff failures, expand the **Danger** job summary or re-run `pnpm exec tsx scripts/narrated-diff.ts --out reports/narrated-diff.md` locally to persist the markdown exported in the PR comment.
3. When SBOM or security gates fail, pull `sbom.cdx.json` and `cosign-bundle.sig` from the `security-scan-${run}` artifact, then rerun `pnpm sbom:generate && pnpm attest:sign` after addressing Semgrep findings.

- CI must pass build, test, lint, typecheck, a11y, security, mutation, charter, and danger jobs in this workflow.
- Generate SBOMs (CycloneDX 1.6) and SLSA/in-toto provenance; sign via Cosign v3 bundle mode and store attestation references in `run-manifest.json`.
- Evidence: CI run URLs, narrated diff tables, trace-context verification logs, signatures, SBOM artefacts, and the charter job excerpt proving `tdd_plan_reuse_ledger` presence.

#### Remediation playbooks

- **Coverage < 90 % (test job):** run `pnpm test:coverage --runInBand` locally, inspect `coverage-results.json`, and add targeted unit tests before re-running `pnpm exec tsx scripts/ci/summarize-coverage.mjs` to refresh the HTML report.
- **Mutation score < 90 % (mutation job):** execute `pnpm exec tsx scripts/ci/mutation.sh` or `pnpm exec stryker run`, focus on surviving mutants reported in `reports/mutation/mutation.json`, and augment assertions until `mutation-results.json.threshold.passed` is `true`.
- **Narrated diff missing (danger job):** regenerate the narrative with `pnpm exec tsx scripts/narrated-diff.ts --out reports/narrated-diff.md`, paste the summary into the PR description, and confirm the Danger job comment acknowledges the update.
- **Trace context gaps (charter job):** review `trace-context.log` from the charter artifact, ensure loggers call the shared OTEL helpers with `{ "brand": "brAInwav" }`, then rerun `pnpm exec tsx scripts/ci/verify-trace-context.ts out/trace-context.log`.
- **SBOM / provenance failure (security job):** regenerate artefacts with `pnpm sbom:generate`, sign via `pnpm attest:sign --bundle sbom/attestations`, and rerun `pnpm exec tsx scripts/ci/security-scan.sh` until Trivy and Semgrep both report zero blocking findings.
- **Reuse ledger pointer missing/stale:** refresh `implementation-plan.md#reuse-ledger`, update `run-manifest.json.evidence.tdd_plan_reuse_ledger` (use repo-relative paths such as `tasks/<slug>/implementation-plan.md#reuse-ledger`), then rerun `pnpm exec tsx scripts/ci/enforce-gates.mjs --manifest run-manifest.json` or dispatch the `charter` workflow to regenerate `quality-report.json` for reviewers.

#### Rollback plan: disabling `charter-enforce`

1. **Pause merges:** announce a merge freeze in `#release-ops` and label open PRs with `needs-charter-waiver`.
2. **Disable workflow:** use `gh workflow disable charter-enforce` (or Actions UI → workflow → ⋯ → Disable) and record the waiver under `/.insula/waivers/` referencing G7.
3. **Compensate controls:** require manual execution of `pnpm test:coverage`, `pnpm exec tsx scripts/ci/mutation.sh`, `pnpm sbom:generate`, and `pnpm attest:sign`; attach artefacts to the PR until automation resumes.
4. **Restore workflow:** once blockers clear, run `gh workflow enable charter-enforce`, trigger `gh workflow run charter-enforce --ref main`, and verify all guardrails succeed before lifting the merge freeze.

#### External contributor adaptation

- Forked PRs cannot access signing secrets; maintainers must run `charter-enforce` on a trusted branch before merge and attach `sbom.cdx.json` + Cosign bundles to the release evidence.
- Request contributors to upload local coverage (`coverage-results.json`) and mutation reports (`mutation-results.json`) as PR attachments when CI skips secret-backed jobs.
- Use a maintainer-triggered `workflow_dispatch` run with `allow_fork_pr: true` for the security and danger jobs so external contributions still receive narrated diff and Semgrep feedback without exposing credentials.
- Document any waived gates in `/.insula/waivers/` with remediation owners and expiry ≤30 days; rerun the full pipeline on the integration branch after merging external work.

⸻

### G8 Ship (Release)

- SemVer; Changesets/Nx release; signed tags.
- Progressive rollout behind feature flags; monitoring enabled.
- Update READMEs, API docs, user docs.
- Evidence: changelog, release URL, rollout notes.

⸻

### G9 Monitor and Iterate

- Observe OTLP traces/logs/metrics; maintain error budgets and rollback criteria.
- Record model drift/retraining logs in `monitoring/`.
- Post-ship review captured in `postship.md`.
- **Reuse policy telemetry:**
  - Track **reuse adoption rate** by parsing `run-manifest.json` and `review.md` into `ops/observability/dashboards/reuse-governance.json`.
  - Track **Tier 3 escalations** using the same sources.
  - Track **average candidate count per task** from parsed manifest data.
  - Track **checklist exception frequency** from review checklists.
  - **Alerting criteria:** Integrate the feed into the Ops dashboard and trigger an alert when Tier 3 escalations spike ≥30 % week-over-week.
- **Quarterly audits:** Schedule audits comparing manifest tier transitions against reuse checklist matrices; store findings under `ops/observability/audits/<yyyy-mm>/reuse-governance.md` with remediation owners and due dates.
- Evidence: dashboards, metrics snapshots.

⸻

### G10 Archive and Index

- Compress `~/tasks/<slug>/` artifacts, reports, ADRs, evidence.
- Mirror filled review checklist to `.insula/audit/reviews/<PR_NUMBER>-<SHORT_SHA>.md`.
- Index specs/tests/contracts to the Memory API for RAG.
- Evidence: `archive.json` and storage path.

⸻

### Checklist Lag Contingency (until reuse checklist ships)

- Add a temporary "Reuse Exception Evidence" section to the PR template pointing to the eventual checklist IDs; require authors to fill it before requesting review.
- Log every reuse exception manually in `logs/reuse-exceptions.md` (columns: PR, candidate IDs, evidence links, waiver status, mitigation owner, expiry) and include meeting notes with governance maintainers on release timelines.
- Mirror the temporary review steps in `review.md#reuse-evidence` so reviewers mimic the forthcoming checklist by verifying candidate catalogues, escalation artefacts, and tier changes manually.
- Create backlog tasks to backfill PRs merged during the gap once the official checklist is live; store the task list in `logs/reuse-exceptions.md` beneath the active table.

⸻

## Arc Records and Templates

Each arc is stored under `~/tasks/<slug>/arcs/<n>/` and contains:

- North-Star acceptance test path
- Plan (≤ 7 steps)
- Contract snapshot (`design/contracts/...`)
- Evidence Triplet (milestone test proof, contract snapshot, reviewer JSON)
- Session reset markers and recap excerpts
- TDD plan reuse ledger pointer

Template: `templates/tdd-arc.template.md`.

⸻

## Run Manifest Schema (v2 excerpt)

```json
{
  "$id": "schemas/run-manifest.v2.json",
  "type": "object",
  "required": ["task", "tier", "north_star", "arcs", "session_resets", "evidence"],
  "properties": {
    "task": { "type": "string" },
    "tier": { "type": "string", "enum": ["fix", "feature", "refactor"] },
    "north_star": {
      "type": "object",
      "required": ["goal", "acceptance_test_path"],
      "properties": {
        "goal": { "type": "string", "maxLength": 140 },
        "acceptance_test_path": { "type": "string" }
      }
    },
    "arcs": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["index", "plan_steps", "contract_snapshot", "evidence_triplet"],
        "properties": {
          "index": { "type": "integer", "minimum": 1 },
          "plan_steps": { "type": "array", "maxItems": 7, "items": { "type": "string" } },
          "contract_snapshot": { "type": "string" },
          "evidence_triplet": {
            "type": "object",
            "required": ["milestone_test", "contract_snapshot", "review_json"],
            "properties": {
              "milestone_test": { "type": "string" },
              "contract_snapshot": { "type": "string" },
              "review_json": { "type": "string" }
            }
          }
        }
      }
    },
    "session_resets": { "type": "array", "items": { "type": "string", "format": "date-time" } },
    "evidence": {
      "type": "object",
      "properties": {
        "vibe_check_log": { "type": "string" },
        "recaps_log": { "type": "string" },
        "tdd_plan_reuse_ledger": { "type": "string" }
      }
    }
  }
}
```

⸻

## Scaffolding CLI (reduces cognitive load)

```bash
# Create task with tier and boilerplate (notes, plan, templates, CI stubs, manifest)
pnpm task:new --slug "new-feature-slug" --tier "feature"

# Start a new arc with a prefilled template
pnpm arc:new --slug "new-feature-slug" --title "Arc 1: save+fetch by id"
# -> creates ~/tasks/new-feature-slug/arcs/001/ with README from templates/tdd-arc.template.md

# Record session reset (called by the 10-minute reset hook)
pnpm session:reset --slug "new-feature-slug"
```

CLI behavior (expected):

- Generates `run-manifest.json` with tier, north_star, and empty `arcs[]`.
- Pre-creates `tests/acceptance/<slug>.spec.ts` scaffold with a pending test.
- Adds `design/contracts/` and `research/` folders conditionally (Tier 2 only).
- Registers CI jobs (`models:health`, `models:smoke`, `structure:validate`) for the task.

⸻

## Toolchain Resilience (brittleness mitigations)

- Graceful Degradation: If `models:health` or `models:smoke` fail due to transient infra, mark the task blocked; do not bypass. The PR label `blocked:runtime` is required.
- Fallback Modes:
  - Vibe-check: JSON-RPC fallback if the CLI shim fails; identical payload.
  - Connector health checks: accept cached health within 15 minutes for Tier 1 and Tier 3; Tier 2 requires live success.
- Version Pinning: Lock CI tool versions in `/.insula/lock/ci-tools.json`; bump via a dedicated “Tooling Update” PR template.

⸻

## ArcTDD Eight-Step Runbook (Quickstart)

> Canonical copy: `/.insula/runbooks/arc-tdd.md` (versioned with this governance pack).

1. **Spin up the task shell** — `pnpm task:new --slug "<slug>" --tier "<fix|feature|refactor>"` to scaffold `run-manifest.json`, acceptance test stub, and evidence folders.
2. **Author the North-Star** — Fill `run-manifest.json.north_star` and write the failing acceptance test in `tests/acceptance/<slug>.spec.[ts|js|py|http]` before touching implementation code.
3. **Draft the ≤7-step arc plan** — Update `implementation-plan.md` and `json/baton.v1.json` with no more than seven concrete steps; note recap cadence (`evidence/recaps.log`) every 400–700 tokens.
4. **Run the preflight guard trio** — Execute:

  ```bash
  curl -s ${VIBE_CHECK_HTTP_URL:-http://127.0.0.1:2091}/mcp \
    -H 'Content-Type: application/json' \
    -d @~/.insula-mcp/tasks/<slug>/payloads/vibe-check-<session>.json \
    | tee ~/.insula-mcp/tasks/<slug>/logs/vibe-check/<session>.json
  pnpm models:health && pnpm models:smoke
  pnpm tsx scripts/ci/verify-trace-context.ts <logfile>
  ```

  Commit raw outputs to `logs/vibe-check/<slug>-<arc>-<timestamp>.json`, `logs/models/<slug>-<timestamp>-health.json`, and `logs/trace-context/<slug>-<arc>-trace.log`; failure or misnamed artifacts block the arc.
5. **Scaffold failing tests** — Add Milestone (red) tests covering the planned slice; ensure Evidence Triplet placeholder paths are noted in the arc directory.
6. **Run red → green → refactor micro-loops** — Implement just enough code per loop; after each recap cadence window, append `[brAInwav]` recap lines with test status and next intent to `evidence/recaps.log`.
7. **Seal the Evidence Triplet and gates** — Capture (a) Milestone Test diff (red→green), (b) contract snapshot, (c) reviewer JSON pointer; verify with `pnpm evidence:triplet:verify --slug <slug>`; then run `pnpm test:smart`, `pnpm lint:smart`, `pnpm typecheck:smart`, `pnpm security:scan`, and coverage/mutation commands.
8. **Package for review and merge** — Complete the code-review checklist, attach vibe-check/model/trace/SBOM artifacts, emit telemetry via `pnpm telemetry:arc-tdd --slug <slug>`, request human review, and merge only after G7 signatures and cosign bundles are stored in `run-manifest.json`.

⸻

### Common Failure Modes → Fixes

| Step | Failure signal | Self-diagnose | Fix |
| --- | --- | --- | --- |
| 1 | `pnpm task:new` missing artifacts | `~/tasks/<slug>/` lacks `run-manifest.json` or acceptance stub | Re-run scaffold command; ensure tier flag matches manifest |
| 2 | Acceptance test still pending at review | `tests/acceptance/<slug>.spec.*` contains `it.skip` or TODO | Replace with executable failing test; commit before implementation |
| 3 | Plan exceeds 7 steps | `implementation-plan.md` has ≥8 bullets | Split into additional arc; update `json/baton.v1.json` and manifest |
| 4 | Preflight logs absent in PR checklist | PR lacks links to vibe-check/models/trace evidence, or filenames do not follow `<slug>-<arc>-<timestamp>` patterns | Re-run commands above; store outputs in canonical folders with naming convention and link |
| 5 | Evidence Triplet incomplete | Arc folder missing milestone diff/contract snapshot/reviewer JSON pointer | Generate failing then passing test diff, capture contract, produce reviewer JSON |
| 6 | Recap drift | `evidence/recaps.log` missing entries every 400–700 tokens | Add recap hook; staged commits must include recap updates or set `CORTEX_SKIP_RECAP_ENFORCEMENT=1` with waiver |
| 7 | Local gates red | `pnpm test:smart` or scans failing | Fix underlying code/tests; rerun until green before requesting review; confirm `pnpm evidence:triplet:verify` passes |
| 8 | Merge blocked by unsigned artifacts | `run-manifest.json` missing cosign bundle paths or telemetry export absent | Re-run SBOM + signing pipeline (`pnpm sbom:generate && pnpm attest:sign && pnpm verify:attest`), update manifest, and re-run `pnpm telemetry:arc-tdd` |

⸻
