# Developer Runbook

> For charter-first onboarding, see `/.cortexdx/runbooks/arc-tdd.md` (ArcTDD Contributor Runbook).

## Bootstrap

```bash
mise install           # install pinned toolchain
corepack enable
pnpm install
pnpm build
pnpm test
```

## Add a new package

```bash
nx g @nx/js:library --name=orchestration --directory=packages
```

## Python app

```bash
cd apps/cortex-py
uv sync
uv run pytest -q
```

## Rust TUI

```bash
cd apps/cortex-tui
cargo build --release
cargo run
```

## Bun pilot (local)

```bash
bun install
bun run -T nx run-many -t test --parallel
```

### Keyboard tips

- Nx graph: `pnpm graph`, open in browser, use `?` for keys.
- Terminal: prefer `Ctrl-C` to stop Nx runners; arrow keys navigate Nx prompts.

### Accessibility flags

- Do not rely on color-only status in TUI. Provide text labels in ratatui.
- Ensure CI logs include explicit PASS/FAIL text.
- Provide `--plain` CLIs where possible for screen readers.

## Memory promotion tuning (dev)

- Use short TTLs locally: `MEMORY_SHORT_TERM_TTL_MS=15000` keeps promotion loops fast for tests.
- Drop the auto-promotion bar with `MEMORY_SHORT_TERM_PROMOTION_IMPORTANCE=6` only while reproducing promotion issues; reset to `8` before merging.
- Tail logs for `brAInwav short-term memory cleanup removed` to confirm expiry cadence and `brAInwav memory_layer backfill completed` after tweaks.

## Closing Waivers After Outages

1. **Regenerate Evidence** – rerun preflight guards so new `NORTH_STAR:RED_FIRST` and `NORTH_STAR:GREEN_AFTER` logs appear. Update manifests with `scripts/governance/backfill-log-evidence.ts --all --report reports/log-evidence-summary.json` so every pointer and hash is captured for auditors, then commit the refreshed artifacts alongside the generated report.
2. **Update Waiver File** – set `status: closed`, add `closed_at` (ISO-8601), and summarise remediation plus manifest pointers in the waiver markdown.
3. **Verify Policy Compliance** – execute `pnpm policy:validate --all` and `pnpm --filter @cortex-os/policy test` to prove the evidence now passes automation. Attach the command output to the PR or incident record.
4. **Communicate** – note the closure in the incident timeline and ping reviewers with the manifest diff. Include hashes for regenerated logs so auditors can confirm tamper-free recovery.
