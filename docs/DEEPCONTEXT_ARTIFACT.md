# DeepContext Artifact Guide

CI uploads the DeepContext cache (`.cortexdx/deepcontext-status.json` plus the semantic index under `.codex-context/`) on every run so reviewers can validate semantic evidence without executing the full pipeline locally. This document explains how to read that artifact and what to include in PR notes.

## Artifact Contents

| File | Purpose |
|------|---------|
| `.cortexdx/deepcontext-status.json` | Snapshot of the most recent `cortexdx deepcontext status` command. Includes index checksum, codebase root, indexed paths, and last sync timestamp. |
| `.codex-context/*` | Compressed semantic index shards used by DeepContext for follow-up queries. These files confirm that the index was built from the current branch. |
| `deepcontext.log` (optional) | Verbose CLI log, present when the status command detected issues or required reindexing. |

## How to Review

1. Download the artifact from the GitHub Actions run associated with the PR.
2. Inspect `.cortexdx/deepcontext-status.json`:
   - Confirm `codebaseRoot` matches the repository you’re reviewing.
   - Verify `lastIndexedAt` is newer than the latest commit timestamp.
   - Check `indexedPaths` for the directories touched by the PR.
3. When the PR introduces new languages or large subdirectories, ensure the `paths` array includes them. If not, request the author to re-run `cortexdx deepcontext index <repo>`.
4. If the artifact contains a `log` section or the upload includes `deepcontext.log`, scan it for warnings (missing files, credential errors, etc.).

## PR Checklist Update

Every PR that relies on DeepContext should add the following line to its description:

```
- [ ] DeepContext artifact reviewed — see docs/DEEPCONTEXT_ARTIFACT.md for interpretation steps.
```

If the artifact indicates stale indexes or missing paths, fail the checkbox and explain what follow-up is required.

## Frequently Asked Questions

- **Do I need secrets to inspect the artifact?** No. The status file and semantic shards are read-only and contain no credentials.
- **What if the artifact is missing?** Ask the author to run `pnpm deepcontext:status` locally (after `cortexdx deepcontext index …`) and push the generated `.cortexdx/deepcontext-status.json`. CI uploads that file automatically when it exists.
- **How often should I reindex?** Whenever you restructure packages, add new projects, or notice drift between `indexedPaths` and the files touched in your PR.
