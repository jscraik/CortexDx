# Agentic Phase Policy (R→G→F→REVIEW)

**Goal:** Agents auto-progress through phases without stopping for HITL, and request HITL **only** at **REVIEW**.

---

## Phases & Gates

- **R (Red)** — write failing tests; plan minimal pass.
  - **Allowed:** planning, write tests, minimal code-gen, `vibe_check`, Local Memory ops, **time-freshness check**, **academic research enhancement**.
  - **Forbidden:** `human_input`, production deploy, merge (G0/G1 Ask-First clarifying questions noted below are the only HITL carve-out).
  - **Auto-advance → G when:** CI shows new tests **fail first**, then **pass** on the next commit, and **TIME_FRESHNESS:OK** is present.

- **G (Green)** — implement to pass.
  - **Allowed:** code, fix tests, `pnpm models:health/smoke` (**live only**), security scans.
  - **Forbidden:** `human_input` (Ask-First clarifying questions remain limited to G0/G1).
  - **Auto-advance → F when:**  
    - `pnpm test` **passes**,  
    - Coverage ≥ **90% global** & **95% changed lines**,  
    - **Mutation ≥ 90%** (where enabled).

- **F (Finished)** — refactor, docs, a11y, observability.
  - **Allowed:** refactor (no behavior change), docs, a11y, SBOM/provenance, structure guard.
  - **Forbidden:** `human_input` (Ask-First clarifications stay confined to G0/G1).
  - **Auto-advance → REVIEW when:**  
    - axe/jest-axe **a11y reports attached**,  
    - SBOM + scanners **pass** (Semgrep ERROR=block, gitleaks ANY=block, OSV clean),  
    - `pnpm structure:validate` **passes**,  
    - `pnpm models:health && pnpm models:smoke` logs attached (**live** MLX/Ollama/Frontier; model IDs, dims/norms, latency),  
    - **Local Memory parity** entry recorded for decisions/refactors (MCP & REST).

- **REVIEW**
  - **Allowed:** `human_input` (HITL), Code Review Checklist completion, approvals/waivers per Constitution.
  - **Merge only if:** **all BLOCKERs** in `/.insula/rules/code-review-checklist.md` are **PASS** and all evidence tokens are present.
  - **Note:** As of this writing, the referenced workflow ([`.github/workflows/pr-quality-gates.yml`](../../.github/workflows/pr-quality-gates.yml)) does **not** implement Danger automation, label application, or template validation. The described automation (posting banners, applying labels, showing "Danger run completed" footer) is **not present**. Contributors should manually ensure PR templates are complete and follow the charter; automation may be added in future updates.

### Danger charter remediation (authors)

1. **Verify template fidelity.** Expand the rendered PR description and ensure the **Policy diff**, **Summary**, and **Checks** sections contain substantive, non-placeholder content with fenced code blocks intact.
2. **Sync the branch.** Stage and push the description updates or commits so that CI evaluates the same head SHA you validated locally.
3. **Update and push your PR.** After editing the PR template to ensure all required sections are complete, stage and push your changes so CI can evaluate the latest commit.
4. **Check CI status and labels.** Once CI completes, verify that the Danger automation has updated the PR status and that any blocking labels (such as `blocked:charter`) have been removed. If the label persists, leave a comment noting the CI run URL and proceed to the troubleshooting checklist below.

### Danger charter troubleshooting (authors & maintainers)

- **Local passes, CI fails:** Review the rendered PR description and ensure all required template sections are present and correctly formatted. Check the Danger comment in the PR for the latest timestamp and status. If CI fails but local checks pass, ensure you have pushed all changes and that the PR description is up to date; GitHub caching can sometimes delay updates until a fresh edit is saved.
- **Template headings not detected:** Confirm the heading text exactly matches the template, including capitalization (`## Summary`), and that fences/backticks are balanced. Markdown lint (`pnpm docs:lint`) catches common formatting drift.
- **Automation stuck:** Add a timestamped comment tagging `@jamiescottcraik` with the failing run URL. Include the `pnpm pr:narrated -- --verbose` transcript and any markdownlint output so maintainers can reproduce quickly.

### Emergency charter gate waivers

- **Request:** Draft `/.insula/waivers/<id>.md` citing the charter rule (Agentic Phase Policy REVIEW gate) and the justification, scope, and expiry.
- **Approval:** Obtain sign-off from a maintainer or constitution delegate before merging; record the approver in the waiver front matter and link it in the PR body.
- **Rollback:** Once the incident resolves, restore the PR template sections, push the changes, verify that CI completes successfully and any blocking labels are removed, then update the waiver file with a closure note.

### Extending the narrated Danger ruleset

> [Unverified] The following steps reference Danger scripts, narrated tests, and the `pnpm pr:narrated` command. As of this writing, these tools and commands are **not yet implemented** in the repository.
> Contributors should not attempt these steps until the required infrastructure is available. Track progress in the project roadmap or open an issue for implementation.

1. **Audit the existing rule.** Review the narrated automation job in [`pr-quality-gates.yml`](../../.github/workflows/pr-quality-gates.yml) to understand how the PR body is fetched and evaluated.
2. **Add section checks.** (Planned) Update the Danger script to require the new headings (keep regexes tolerant to whitespace). Add fixtures covering the new block to the narrated tests once implemented.
3. **Document the expectations.** Amend [`PULL_REQUEST_TEMPLATE/default.md`](../../.github/PULL_REQUEST_TEMPLATE/default.md) and the reviewer checklist with guidance for the additional sections before enabling the hard failure.
4. **Stage rollout.** Land documentation/template updates first, then enable the new Danger enforcement behind a temporary "warning" mode before flipping it to a merge blocker.
5. **Validate.** [Planned] Once the `pnpm pr:narrated` command and narrated tests are implemented, run validation against sample PR bodies and attach transcripts to the PR introducing the new rules.

### Task Folder Template Refresh (Effective 2025-11-12)

- **When:** At the next arc boundary before you re-enter **R (Red)**.
- **Action:** Re-run the official scaffolder against the updated templates published on 2025-11-05 — `pnpm task:new --slug <slug> --tier <tier>` — to rebuild `~/.insula-mcp/tasks/<slug>/` from the latest manifest.
- **Carry-forward:** Preserve in-flight evidence (`evidence/`, `logs/`) by moving it to `notes/legacy/` before regeneration, then relink references inside the refreshed task folder.
- **Attestation:** Record `TASK_TEMPLATE_REFRESH:2025-11-12 slug=<slug>` in the next `vibe_check` log and cite `/.insula/rules/TASK_FOLDER_STRUCTURE.md` alongside the updated template SHA.
- **Grace:** Teams completing arcs that end before 2025-11-12 may finish on existing scaffolds; all arcs starting on/after that date MUST use the refreshed structure.
- **Automation:** Run `pnpm task:template:check --strict` at every arc boundary; the checker inspects `run-manifest.json → template` and emits `TASK_TEMPLATE_REFRESH:NEEDED slug=<slug>` when the recorded SHA diverges from `/.insula/templates/task-template-version.json`.
- **Reminder telemetry:** Capture the CLI output in the next `vibe_check` log and update `run-manifest.json → governance.reuseEvidence` once regeneration is complete.

### Reuse Gap Mitigation (Grace Window 2025-11-12 → 2025-12-10)

1. **Document gaps:** Use `analysis/reuse-evaluation.md` to record why reuse failed, attach benchmarks/threat models, and link mitigation tickets.
2. **Waiver protocol:** File a Constitution waiver only when remediation would jeopardise delivery; include the reuse log URL and backlog ticket in the waiver.
3. **Backlog tracking:** Create follow-up issues (label `reuse-debt`) with owners + target arc, and reference them from the checklist and run manifest.
4. **Knowledge sharing:** Schedule weekly reuse syncs or async summaries so teams can converge on shared abstractions; update the governance changelog with systemic gaps.
5. **Observability:** Watch the CI attestation mode (`pnpm governance:reuse-attestation`) and treat WARN findings as action items—mitigation tickets must land before the cutoff when the rule becomes a blocker.

---

## Hard Rules

- **Ask-First Clarifications limited to G0/G1.** Up to **three** Ask-First clarifying questions MAY be issued during G0 Initialize and G1 Research; they MUST enumerate concrete options and consequences per charter guardrail #2.
- **Ask-First logs MUST carry structured metadata.** All compliant clarifying questions are automatically tagged with `human_input:ask_first` entries that include `humanInput.askFirst=true`, prompt style, options, and a budget snapshot. Legacy heuristics remain for backward compatibility but emit monitoring warnings.
- **HITL only at REVIEW.** Any `human_input` before REVIEW is a policy violation **except** the G0/G1 Ask-First clarifying-question allowance above.
- **Temporary Ask-First overrides require waivers.** Overrides MUST declare `value≤5`, waiver URL, approver, approval/expiry timestamps, and reason. Expired or undocumented overrides fall back to the base budget and raise `ask-override` violations/telemetry.
- **Governance required.** Load the nearest `AGENTS.md` and record its SHA in `.cortex/run.yaml`; include it in the first `vibe_check` log.
- **Hybrid model = Live only.** No stubs/recordings/"dry_run" for embeddings/rerankers/generation. Engines must be **live** (MLX, Ollama, Frontier).
- **Secret retrieval via 1Password CLI.** Agents obtain API keys, SSH keys, and tokens on-demand with `op` and must not cache them in shell profiles, long-lived env vars, or repository artifacts.
- **Time Freshness Guard.** Anchor dates to harness "today"; surface **ISO-8601** in specs/PRs/logs; treat "latest/current" as freshness checks.

---

## Evidence Tokens (CI scans logs for these)

- `AGENTS_MD_SHA:<sha>`
- `PHASE_TRANSITION:<from>-><to>`
- `brAInwav-vibe-check`
- `TIME_FRESHNESS:OK tz=<iana_tz> today=<yyyy-mm-dd>`
- `MODELS:LIVE:OK engine=<mlx|ollama|frontier> model=<id> dims=<n> norm≈<v> latency_ms=<n>`
- `A11Y_REPORT:OK`
- `STRUCTURE_GUARD:OK`
- `COVERAGE:OK CHANGED_LINES:OK MUTATION:OK`
- `MEMORY_PARITY:OK`
- `CODE-REVIEW-CHECKLIST: /.insula/rules/code-review-checklist.md`
- `PR_LABEL:blocked:charter` (present → blocked, removed → ready)
- **Telemetry:** Monitor `brAInwav.ask_first.*` Prometheus counters/gauges for question volume, overrides, and budget remaining; cache efficiency appears under `brAInwav.ask_first.summary_cache_events_total{result="hit|miss"}`.

> **Overrides:** Rolling a phase **back** requires a Constitution waiver and must emit
> `PHASE_OVERRIDE:<from>-><to> link=<waiver-url>`; otherwise CI blocks.
