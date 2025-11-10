# Agent Toolkit Source of Truth

The Agent Toolkit now lives exclusively in the Cortex-OS repository. CortexDx no
longer vendors a copy under `packages/agent-toolkit`, which prevents the workspace
from tripping TypeScript/Nx whenever the toolkit is updated upstream.

## What Changed (Effective 2025-11-10)

- The canonical source is `~/.Cortex-OS/packages/agent-toolkit`.
- This repository consumes the toolkit as an external dependency rather than a
  git submodule/subtree.
- Any automation that previously referenced `packages/agent-toolkit` inside
  CortexDx must pivot to the Cortex-OS checkout.

## Working With the Toolkit Locally

1. Keep the Cortex-OS repo up to date:
   ```bash
   cd ~/.Cortex-OS
   git pull --rebase
   ```
2. Run toolkit commands (e.g., `just scout`, `just codemod`) from the
   Cortex-OS repo so they have access to the maintained scripts/binaries.
3. If CortexDx code needs to import the toolkit, depend on the published
   `@cortex-os/agent-toolkit` package or link to your local checkout:
   ```bash
   # from the CortexDx repo root
   pnpm add -D link:../.Cortex-OS/packages/agent-toolkit
   ```
   The link keeps CortexDx builds compiling without duplicating sources.
4. When updating the toolkit, make changes in Cortex-OS, run its test suite, and
   publish or relink. There is no longer a git submodule to sync.

## Why This Matters

- Eliminates drift between CortexDx and Cortex-OS copies of the toolkit.
- Keeps governance (AGENTS.md, ArcTDD charter, accessibility rules) centralized.
- Prevents TypeScript errors such as `TS18003` that occurred when the toolkit was
  only partially synced into this workspace.

For any work that changes the toolkit itself, switch to the Cortex-OS repository
and follow its governance. CortexDx contributors should treat the toolkit as an
external dependency.
