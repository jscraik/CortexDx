# Insula MCP Branch & Workflow Guide

## 1. Branch Strategy

- **main** — production-ready code only. Anything merged here must pass the full pipeline (`pnpm lint && pnpm test && pnpm build`) and ship green `insula-mcp diagnose` artifacts.
- **develop** — staging for the next release. All feature branches merge here first; treat it as an integration branch deployable to an internal environment.
- **feature/<ticket-or-topic>** — short-lived branches for individual tasks. Base new work off `develop`, not `main`.
- **release/<version>** (optional) — cut when you are ready to stabilize a bundle before merging to `main`.

## 2. Environment Setup (one-time per machine)

```bash
git clone git@github.com:.../insula-mcp.git
cd insula-mcp
mise install                  # pins Node 20.11.1 and pnpm 9.12.2
pnpm install                  # workspace deps
```

If your editor warns about `tsserver`, point it to `node_modules/.pnpm/typescript@5.9.3/.../lib/tsserver.js`.

## 3. Day-to-Day Development Flow

1. `git checkout develop && git pull`
2. `git checkout -b feature/<topic>`
3. Run `pnpm install` if the lockfile changed.
4. Follow ArcTDD:
   - Write or adjust the Vitest spec in `packages/insula-mcp/tests`.
   - Implement code under `packages/insula-mcp/src`.
   - Keep functions ≤ 40 lines, named exports only.
   - Maintain determinism and evidence (support `--deterministic`, add evidence pointers).
5. Local checks:

   ```bash
   pnpm lint
   pnpm test         # runs build + vitest
   pnpm build        # tsup bundle + dts
   npx insula-mcp diagnose http://localhost:8088 --out reports/dev  # optional mock validation
   ```

6. Update `README.md`/`vision.md`/`AGENTS.md` if flags or behaviour change.
7. Commit, push, and open a PR targeting `develop`. Include the checklist from `AGENTS.md`.

## 4. Promoting to Production

- Merge feature branches into `develop`.
- Once stable, cut `release/<version>` (optional), run the full suite plus any manual mock checks, then merge to `main`.
- Tag the release if needed; CI on `main` must be green before deploy.

## 5. Non-Production Experiments

- Use the same feature-branch flow but clearly prefix branches (`experiment/<name>`). Keep experiments isolated; do not merge without review.
- If experiments need additional tooling, wrap them behind feature flags or separate scripts, and document them before merging into `develop`.

## 6. Feature Implementation Tips

- Add a plugin → create the file in `src/plugins/`, update the registry (`src/plugins/index.ts`), add tests, and optionally provide a mock server.
- Extend the CLI → edit `src/cli.ts`, document new flags in `README.md`, and ensure commander options respect `Number.parseInt`, deterministic flows, and similar governance requirements.
- Confirm Nx targets (`pnpm build`, `pnpm test`, `pnpm lint`) stay green; update `project.json` only if you add new targets.

## 7. Continuous Integration Expectations

- GitHub Action runs `pnpm build`, `pnpm lint`, `pnpm test`, then `insula-mcp diagnose`. Blockers or majors fail the job unless explicitly flagged.
- CI uploads reports (Markdown/JSON/ArcTDD/file-plan) and SBOM. Keep the action green before merging anything to `develop` or `main`.

Follow this rhythm to maintain a clear separation between production-ready (`main`), staging (`develop`), and feature experimentation, aligned with Insula MCP governance and tooling.
