# ArcTDD Eight-Step Runbook

**Scope:** Applies to all agents completing Tier 1–3 arcs under the ArcTDD Charter.
**Versioned with:** `/.cortexdx/rules/` governance pack.

1. **Spin up the task shell**
   - Command: `pnpm changelog:new --slug "<slug>" --tier "<fix|feature|refactor>"`
   - Output: `run-manifest.json`, acceptance test stub, `evidence/`, `logs/`
2. **Author the North-Star**
   - Update `run-manifest.json.north_star`
   - Write the failing acceptance test at `tests/acceptance/<slug>.spec.[ts|js|py|http]`
3. **Draft the ≤7-step arc plan**
   - Edit `implementation-plan.md` and `json/baton.v1.json`
   - Schedule recaps every 400–700 tokens to `evidence/recaps.log`
4. **Run the preflight guard trio**

 ```bash
  pnpm oversight:vibe-check --goal "<task>" --plan "<steps>" --session <id>
  pnpm models:health && pnpm models:smoke
  pnpm tsx scripts/ci/verify-trace-context.ts <logfile>
  ```

- Persist outputs to `logs/vibe-check/<slug>-<arc>-<timestamp>.json`, `logs/models/<slug>-<timestamp>-health.json`, `logs/trace-context/<slug>-<arc>-trace.log`

5. **Scaffold failing tests**
   - Create Milestone (red) tests for the planned slice
   - Record Evidence Triplet placeholders inside `~/Changelog/<slug>/arcs/<n>/`
6. **Run red → green → refactor micro-loops**
   - Keep loops ≤20 minutes or ≤3 commits
   - Append `[brAInwav]` recap entries after each cadence window
7. **Seal the Evidence Triplet and gates**
   - Capture Milestone Test diff, contract snapshot, reviewer JSON pointer
   - Verify artifacts via `pnpm evidence:triplet:verify --slug <slug>`
   - Run `pnpm test:smart`, `pnpm lint:smart`, `pnpm typecheck:smart`, `pnpm security:scan`, coverage, mutation
8. **Package for review and merge**
   - Complete `/.cortexdx/rules/code-review-checklist.md`
   - Attach vibe-check, model health, trace, SBOM, cosign bundle evidence; update `run-manifest.json`
   - Emit ArcTDD telemetry snapshot with `pnpm telemetry:arc-tdd --slug <slug>`

## Common Failure Modes → Fixes

| Step | Failure signal | Self-diagnose | Fix |
| --- | --- | --- | --- |
| 1 | Missing `run-manifest.json` | `~/Changelog/<slug>/` lacks scaffold | Re-run `pnpm changelog:new` with correct tier |
| 2 | Acceptance test skipped | `it.skip`/TODO present | Replace with real failing test, commit |
| 3 | Plan >7 steps | Too many bullets | Split arcs; update manifest |
| 4 | No preflight evidence | PR checklist missing links or filenames stray from `<slug>-<arc>-<timestamp>` | Re-run commands; store logs with canonical names |
| 5 | Evidence Triplet gap | Arc dir missing artifact | Produce diff/contract/reviewer JSON |
| 6 | Recap gaps | `evidence/recaps.log` sparse | Ensure staged commits include recap updates or document override |
| 7 | Gates failing | `pnpm test:smart` or scans red | Fix code/tests; rerun; confirm `pnpm evidence:triplet:verify` passes |
| 8 | Unsigned artifacts | Manifest missing cosign bundle or telemetry export | Re-run SBOM + signing pipeline and `pnpm telemetry:arc-tdd` |
