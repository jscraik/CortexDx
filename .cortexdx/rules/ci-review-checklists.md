# CI Review Checklists

**Status:** Authoritative — CI jobs MUST enforce these gates
**Scope:** Applies to all Cortex-OS repositories and downstream packages.
**Maintainer:** brAInwav Development Team
**Last Updated:** 2025-11-11

---

## Checklist Overview

CI review checklists map ArcTDD guardrails to automated jobs. Each job publishes evidence that reviewers cite in PR discussions. If a checklist fails, merges are blocked until the violation is addressed or an approved waiver is recorded in `.cortexdx/waivers/`.

| Checklist | Responsible Job | Evidence Hook |
| --- | --- | --- |
| Charter propagation | `charter-enforce / danger` | Danger comment with `CHARTER_SHA256` and Apply Waiver link |
| Governance index validation | `agents-guard` | `governance-index.json` hash + token scan summary |
| Structured outputs | `trace-verify` | Contract validator logs showing schema compliance |
| Academic research + licensing | `agents-guard` | `logs/academic-research/findings.json` + license validation report |
| Live model health | `models-smoke` | `MODELS:LIVE:OK` entries with engine, IDs, latency |
| WCAG evidence | `a11y-check` | axe/jest-axe or Playwright report |

---

## G0 Security

- Semgrep (**ERROR=block**), gitleaks (**ANY=block**), OSV audit.
- Structured outputs enforced (`LLM‑S0`), cancellation enforced (`LLM‑S1`).
- Logs show `[brAInwav]`, `brand:"brAInwav"`, `trace_id`, and `MODELS:LIVE:OK` for model activity.
- Run `pnpm security:scan` locally before pushing; attach the latest scanner artifacts to the PR.

## G7 Docs & Ops

- `AGENTS_MD_SHA:<sha>` present in PR body and reviewer notes.
- Documentation links resolve; `docs-validate` passes without `ERROR`.
- Evidence Triplet referenced in the PR template and Danger summary.
- `governance-index.json` digests updated when governance docs change; CI compares hashes and blocks drift.

---

## Usage Notes

1. Reviewers cite the checklist items when approving PRs.
2. If a checklist fails, add the `blocked:charter` label and request a fix or waiver.
3. Keep the checklists synchronized with `/.cortexdx/rules/governance-index.json`; update both files in the same commit when adding or removing guardrails.
