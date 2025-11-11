---
trigger: always_on
alwaysApply: true
---
# Code Review Checklist (General + AI + Expanded)

> **Severity legend:**
> **[BLOCKER]** must be PASS before merge. **[MAJOR]** fix or obtain Constitution waiver. **[MINOR]** follow-up task allowed.
>
> **Charter gate:** Reviewers MUST confirm that the PR template sections **Policy diff**, **Summary**, and **Checks** ([`.github/PULL_REQUEST_TEMPLATE/default.md`](../../.github/PULL_REQUEST_TEMPLATE/default.md)) are completed with substantive entries. If any required section is empty, the PR must be updated before review can conclude. Reviewers must manually verify that any `blocked:charter` label is cleared and the PR body contains meaningful information before checking the box below.
>
> **Transition Notice (Reuse-First Delivery Policy):** From **2025-11-12** through **2025-12-10**, the new reuse-first attestation in §2 operates in **WARN/MAJOR** mode; merge is permitted with documented remediation plans. On **2025-12-11**, CI will flip the rule to **BLOCKER** and block merges without compliant evidence.

## 0. Preconditions & Governance

- [ ] **[BLOCKER] Human reviewer (non-author):** This checklist is completed and posted by a human who is **not** the PR author.
- [ ] **[BLOCKER] `blocked:charter` cleared:** The `blocked:charter` label is not present on the PR after all required template sections are completed.
  - Label column inspected (timestamp): ____________________
  - PR template sections validated for substance: ✅ / Needs fix
- [ ] **[BLOCKER] AGENTS.md acknowledged:** Nearest `AGENTS.md` loaded; PR/logs include `AGENTS_MD_SHA:<sha>` and section IDs cited where rules apply.
- [ ] **[BLOCKER] Release signal verified:** `Changeset Guard` status check reports success or a justified `skip-release` label is present in the PR discussion.
  - Evidence link (comment URL or screenshot): __________________________________
  - Multi-package guard respected (`skip-release` absent when >1 published package changes): ✅ / Needs fix
- [ ] **[BLOCKER] Vibe-check evidence:** Logs include `brAInwav-vibe-check` for plan→act gates with `--with-academic-research` flag and research evidence in `logs/academic-research/findings.json`.
- [ ] **Doc-hardening evidence archived:** Reviewer confirms the PR links to the latest timestamped logs under `tasks/doc-hardening/evidence/` (lint/test/build) and cites `tasks/doc-hardening/verification/trace.log` for command provenance.
- [ ] **[BLOCKER] Time Freshness Guard:** Dates in PR/specs are anchored to harness "today" and expressed in ISO-8601; no ambiguous "yesterday/last week".
- [ ] **[BLOCKER] Danger cleared:** PR body contains Narrated diff, full Evidence Triplet, and `CHARTER_SHA256`; `blocked:charter` label absent.
- [ ] **[BLOCKER] Charter propagation verified:** If `/.cortex/rules/CHARTER_FRAGMENT.md` or related governance docs change, confirm `pnpm charter:inject` + `pnpm charter:validate` ran, CODESTYLE/reviewer docs were updated, and the Danger comment links to the Apply Waiver workflow. Evidence pointer: ____________________
- **Waiver Activation Rule:** A charter waiver is valid only after the `charter-enforce / danger` job posts ✅ with a link to the `Apply Waiver` workflow run that recorded Maintainer approval.
  - Detection: Treat any Danger comment missing the `Apply Waiver` link (or still ❌) as provisional—`blocked:charter` stays until resolved.
  - Diagnostics: Check GitHub Actions → **Apply Waiver** for the PR branch/run; ensure the workflow succeeded and produced the approval URL. Confirm the PR body lists waiver ID, scope, expiry, and compensating controls.
  - Remediation: Trigger or re-run the Apply Waiver workflow, update the PR description with missing metadata, then re-run the Danger job (UI rerun or doc-only commit). Verify the regenerated comment carries the workflow link.
  - Documentation: Add a reviewer note summarizing remediation, include the workflow URL, and attach relevant logs/screenshots. Keep `blocked:charter` until that note exists.
- [ ] **[BLOCKER] Release plan verified:** "Changeset release preview" comment aligns with the diff, or a documented `skip-release` waiver label is present.
- [ ] **[MAJOR] Phase machine honored:** No `human_input` usage before **REVIEW** phase; phase tokens present (`PHASE_TRANSITION:*`).

## 1. Author Preparation

- [ ] **Self-review done;** tests run locally; PR description is clear and scoped.
- [ ] **Small, focused change;** no unrelated concerns mixed.

## 2. Implementation & Design

- [ ] **[BLOCKER] Meets requirements** without unnecessary scope or hidden TODOs.
- [ ] **Simplicity first;** opportunities to de-complexify noted/refactored.
- [ ] **Dependencies & abstraction appropriate;** avoid bloat and license issues.
- [ ] **Correct imports;** unused removed; path aliases sane.
- [ ] **Reuse existing code;** common logic extracted where appropriate.
- [ ] **Hyperlinks to reused components provided** using `[link text](absolute-url#artifact-id)` format.
- [ ] **TDD plan reuse entry confirmed** before approving helpers.
- [ ] **Automation tag present:** `HELPER_REUSE:OK` included for automation.
  - Run `pnpm governance:lint-checklist` (or `pnpm lint:docs`) to auto-verify link format and `HELPER_REUSE:OK`; attach the lint log in the PR evidence bundle.
- [ ] **Design principles:** SOLID where helpful; no premature generalization.
- [ ] **Design artefacts present:** up-to-date wireframes/diagrams/research/TDD plan attached in task folder.
- [ ] **Evidence Triplet attached:** failing test link, passing test link, and mutation/property proof captured with paths/log IDs.
- [ ] **Interface compliance:** MCP/A2A/REST endpoints, versioning, error semantics documented and tested.
- [ ] **Domain boundaries:** **No cross-domain imports**; interactions via declared contracts/schemas only; helper changes include domain inventory diff (`pnpm helpers:list --domain --diff origin/main > helpers-domain-diff.md`) with justification if crossings are unavoidable and the diff artifact attached.

### Reuse-First Evidence Expectations (Effective 2025-11-12)

- **Artifact path:** `analysis/reuse-evaluation.md` inside the active task folder; commit alongside implementation changes.
- **Template:** Populate `/.cortex/templates/reuse-evaluation-template.md` and keep Summary, Candidate Survey, Trace, and Outcome sections intact.
- **Content:** Enumerate candidate modules/services, capability fit, risks, and decisions with links to code, docs, benchmarks, or threat models.
- **Traceability:** Record search queries (`rg`, `nx graph`, catalog lookups) and attach follow-up ticket IDs or waiver references when gaps are discovered.
- **Run-manifest linkage:** Ensure `run-manifest.json` → `governance.reuseEvidence` points to the latest log and reflects the template version/sha.

### Reviewer Playbook — Reuse-First Attestation

- Confirm the cited artifact exists, is updated for the current arc, and references concrete candidates (not generic checkboxes).
- Require measurable justification (tests, benchmarks, load profiles, security findings) when teams decline reuse.
- Flag superficial evidence (copy-pasted text, missing search trace, unrelated modules) and request revisions before approval.
- Check that tests cover reused components or justify new code paths; insist on remediation tickets for genuine reuse gaps.
- Escalate unresolved disagreements through the Constitution waiver path and record the waiver ID in the checklist.

### Grace-Period Support (2025-11-12 → 2025-12-10)

- During the WARN window, merges MAY proceed with a mitigation ticket if the artifact details the reuse gap and remediation timeline.
- Make sure teams log `TASK_TEMPLATE_REFRESH` events and reuse follow-ups in task folders before entering the next arc.
- Encourage cross-team syncs or shared channels when repeated gaps surface; highlight patterns to governance for prioritised fixes.
- After **2025-12-11**, treat missing or stale reuse evidence as a merge blocker; approvals require either compliant evidence or a documented waiver.

## 2.1 brAInwav Constitutional Compliance

- [ ] **[BLOCKER] Branding present:** Logs/errors/health include `"[brAInwav]"` and `brand:"brAInwav"`.
- [ ] **[BLOCKER] No mock prod claims:** No `Math.random()` fabrications, placeholder adapters, hard-coded mocks, fake metrics, or `TODO/FIXME/HACK` in prod paths.
- [ ] **[BLOCKER] Function size ≤ 40 lines** (compose/guard clauses if larger).
- [ ] **[BLOCKER] Named exports only;** no `export default`.
- [ ] **[BLOCKER] No `any` in production** (allowed only in tests/justified compat shims).
- [ ] **Reality Filter:** Generated/inferred content labeled `[Inference]/[Speculation]/[Unverified]` where applicable.
- [ ] **[BLOCKER] Wikidata workflow compliance:** Fact-finding changes use `executeWikidataWorkflow` and approved MCP
      vector/claims/SPARQL tooling with provenance metadata recorded per the Wikidata integration guide.

## 3. Functionality & Logic

- [ ] **Correctness** across happy/edge paths; concurrency/races considered.
- [ ] **User impact** evaluated; demo notes/screenshots if UI/UX-facing.
- [ ] **Rollback plan** documented and tested.
- [ ] **Feature flags** guard risky features.

## 4. Complexity & Readability

- [ ] **Good naming & structure;** files/packages appropriate.
- [ ] **Readable control/data flow.**
- [ ] **Comments explain "why";** stale comments removed.
- [ ] **No commented-out/obsolete code.**
- [ ] **Debug code removed.**

## 5. Error Handling, Logging & Monitoring

- [ ] **Consistent error handling;** no swallowing; use `cause`.
- [ ] **Logging right-sized;** no sensitive data leakage.
- [ ] **Observability:** OTel traces/metrics wired; dashboards/alerts updated.
- [ ] **User messages** clear, actionable.
- [ ] **Alert fatigue check** performed.

## 6. Dependencies, Documentation & Configuration

- [ ] **Docs updated:** READMEs/API/config/design artefacts.
- [ ] **Doc-proof satisfied:** Each external API call cites DOC block + docsnap/OpenAPI pointer with checksum evidence in PR.
- [ ] **System impacts/back-compat** considered.
- [ ] **[BLOCKER] Secrets/config:** No hard-coded secrets; credentials retrieved via the 1Password CLI (`op`) at runtime; secure env management.
- [ ] **[BLOCKER] Env loader:** Uses shared loader (`scripts/utils/dotenv-loader.mjs` or `@cortex-os/utils`); **no direct `dotenv.config()`**.
- [ ] **Local Memory compliance:** `.github/instructions/memories.instructions.md` updated; MCP/REST parity observed; oversight log attached when AGENTS files changed.
- [ ] **Vision & layout alignment** (package vision, directory structure, scaffolding).
- [ ] **Build verification** passes locally and in CI.
- [ ] **Migrations:** Idempotent, performant, and tested.
- [ ] **Retention policies** honored.
- [ ] **IaC/Helm** updated where relevant.
- [ ] **Release notes** and **runbooks/IR** updated.
- [ ] **CHANGELOG** and versioning updated as needed.
- [ ] **Co-authored commit** line present when applicable.
- [ ] **Structure guard:** `pnpm structure:validate` passes.

## 7. Security & Supply Chain

- [ ] **[BLOCKER] Scanners clean:** Semgrep (**block ERROR**), gitleaks (**block ANY**), OSV/audit clean for lockfiles.
- [ ] **AuthN/Z correct;** least privilege enforced.
- [ ] **MCP OAuth scopes (Auth0):** `search.read docs.write memory.read memory.write memory.delete`; RBAC + Add-Permissions-in-Token enabled.
- [ ] **Input validation/sanitization** throughout boundaries.
- [ ] **Sensitive data** encrypted and protected.
- [ ] **SBOM & provenance:** CycloneDX generated; SLSA/in-toto attestations present; container images signed (Cosign).
- [ ] **Helper security coverage:** Semgrep/gitleaks/OSV evidence references both reused modules and any new helper paths; waivers filed when exceptions exist.
- [ ] **Containers:** Minimal base, pinned digests, non-root, read-only FS, dropped caps.
- [ ] **Helper introduction deltas:** New helpers document benchmark deltas and security scan delta results before approval (`attach BENCH_DELTA.md` + `SEC_SCAN_DIFF.json`; CI guard `pnpm governance:helpers` validates presence).
  - Pre-submit hook: run `pnpm governance:helpers --check-pre-submit` (or local Husky hook equivalent) to ensure artifacts are staged; link the command log in review notes.

## 8. Performance & Scalability

- [ ] **Perf impact** measured; regressions avoided.
- [ ] **Opportunities** for improved structures/algorithms noted.
- [ ] **Scalability** considerations documented.
- [ ] **Helper benchmark delta reviewed (Gate G5):** Run `pnpm perf:verify --slug <slug>` to generate verification report (`reports/perf/<slug>.md`) comparing reused path vs helper; results meet plan budgets.

## 9. Usability & Accessibility

- [ ] **User-centric APIs/UI** and docs.
- [ ] **[BLOCKER] Accessibility evidence:** WCAG 2.2 AA verified with axe/jest-axe (reports attached); keyboard/focus order; no color-only signaling.
- [ ] **i18n/l10n:** Strings externalized; date/time/RTL supported.

## 10. Ethics, Responsible AI, and AI Governance

- [ ] **Privacy & non-exploitation** confirmed.
- [ ] **Abuse prevention** mechanisms present.
- [ ] **Inclusiveness & fairness** evaluated; bias mitigated.
- [ ] **Responsible AI docs:** fairness/transparency/robustness/compliance noted.
- [ ] **Model version tracking** (exact IDs) recorded in code/CI/deploy docs.
- [ ] **Reproducibility:** Scripts/configs to recreate inference/training envs.
- [ ] **Explainability artifacts** for complex/AI features.

## 11. Testing, Rollback, & Quality Assurance

- [ ] **[BLOCKER] Coverage gates:** ≥ **90% global** and **95% changed lines**; **mutation ≥ 90%** (where enabled).
- [ ] **Tests fail when code breaks**; negative & boundary tests present.
- [ ] **Evidence Triplet coverage:** Cited failing and passing tests cover both legacy and newly introduced code paths, and mutation reports show no surviving mutants in helper touchpoints (`reports/mutation/**/*helpers*.json`).
  - Evidence Triplet MUST embed a "Mutation Hotspots" table generated via `pnpm evidence:triplet --include-mutation`, highlighting any helper survivors (0 expected).
- [ ] **Maintainable tests** (low brittleness).
- [ ] **Rollback drills** exercised in staging; triggers documented.
- [ ] **Feature toggling** verified.
- [ ] **Branding in tests** validated (`[brAInwav]` in relevant assertions).
- [ ] **Constitutional compliance tests**: no mock prod claims; Reality Filter behaviors covered.
- [ ] **Reuse triplet traceability:** Evidence Triplet links include failing/passing tests that cover the reused module and helper (if added); `run-manifest.json.reuseEvidence.{failingTest,passingTest}` populated.

## 12. Hybrid Model Solution — Live-Only Evidence

- [ ] **[BLOCKER] Live engines only:** No stubs/recordings/dry-runs for embeddings/rerankers/generation.
- [ ] **[BLOCKER] Health/smoke logs attached:** `pnpm models:health && pnpm models:smoke` show `MODELS:LIVE:OK` with engine (`mlx|ollama|frontier`), model IDs, vector dims/norms, and latency samples.
- [ ] **[MAJOR] MCP config & ports consistent:** `.well-known/mcp.json` and port registry (3024/3026/3002/39300) validated.

## 13. Collaboration & Communication

- [ ] **Right reviewers** assigned; respectful, reasoned feedback.
- [ ] **Severity labels** (BLOCKER/MAJOR/MINOR) applied in review comments.
- [ ] **Timely reviews** and timezone awareness.
- [ ] **Psychological safety** maintained.
- [ ] **Process metrics** (review time/defects) tracked periodically.
- [ ] **Cross-functional reviews** (security/UX/DevOps/legal) engaged when needed.
- [ ] **Decisions documented** (trade-offs with evidence).
- [ ] **Stakeholder sign-off** where required.
- [ ] **User comms** prepared (release notes, docs, messaging).

---

## Appendix A — Helper Review Packet Examples

- **Artifacts:** `[Helper name](https://repo/helpers/foo.ts#L42)` (reuse hyperlink), `BENCH_DELTA.md`, `SEC_SCAN_DIFF.json`, mutation report snippet (`reports/mutation/helpers/foo.json`), domain inventory output (`helpers-inventory/foo.md`).
- **Reviewer actions:** Verify hyperlinks resolve, confirm benchmark deltas show <=2% regression, ensure security diff highlights zero new alerts or documented mitigations, check mutation survivors = 0, validate domain inventory matches contracts.
- **Further training:** See `/docs/review/helper-review-playbook.md` for walkthroughs.
  - **Verification required:** Before relying on `/docs/review/helper-review-playbook.md`, reviewers must confirm that the file exists and is accessible. If missing, note this in your review and request the material from the maintainers or use alternative training resources as available.
- **Living gallery:** Curated exemplars live under `/docs/review/helper-gallery/`; reviewers should cross-reference latest packets each quarter and propose updates when automation/report formats evolve.
  - **Verification required:** Before referencing `/docs/review/helper-gallery/`, reviewers must confirm that the directory exists and contains up-to-date exemplars. If missing, document the absence in your review and notify the documentation team to update or restore the gallery.

**Reviewer Signature:** ____________________  **Date (ISO-8601):** __________
**Checklist Path:** `/.cortex/rules/code-review-checklist.md` (canonical)
