# Reuse Evaluation Log

> **Purpose:** Document the investigation into existing components, services, or patterns before authoring new code.
> **Instructions:** Update this log for every arc before implementation begins. Reference actual files, commits, or docs.

## Summary
- **Task slug:** <!-- e.g. cortex-agents-handoff -->
- **Arc ID:** <!-- e.g. arc-2025-11-12-a -->
- **Reviewer link:** <!-- PR comment URL or checklist pointer -->
- **Decision:** <!-- Adopt / Adapt / Build New -->
- **Follow-up ticket (if gap found):** <!-- link or `waiver:<id>` -->

## Candidate Survey

| Component / Service | Capability Fit | Gaps or Risks | Decision | Evidence |
| --- | --- | --- | --- | --- |
| <!-- package/module name --> | <!-- e.g. aligns 80% --> | <!-- describe missing capabilities --> | <!-- Adopt / Adapt / Reject --> | <!-- links to code, docs, benchmarks --> |
|  |  |  |  |  |
|  |  |  |  |  |

## Trace
- **Search queries used:** <!-- `rg`, `nx graph`, catalog lookups -->
- **Relevant issues or RFCs reviewed:** <!-- link IDs -->
- **Benchmark / load test snapshots:** <!-- attach log IDs or file paths -->
- **Security or compliance blockers:** <!-- cite threat model or audit references -->

## Outcome
- **Chosen path:** <!-- describe reuse strategy -->
- **Implementation impact:** <!-- e.g. reduced scope, timeline implications -->
- **Remediation plan for gaps:** <!-- backlog ticket IDs, owners, target arcs -->

---
**Template version:** 2025-11-05 | **Source:** `/.cortexdx/templates/reuse-evaluation-template.md`
