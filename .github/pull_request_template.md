## Summary

- Describe the change and why it’s needed.
- Call out any risky areas reviewers should focus on.

## Checklist

- [ ] Tests/lint/build (`pnpm lint && pnpm test && pnpm build`) passed locally.
- [ ] DeepContext artifact uploaded **and** reviewed (see `docs/DEEPCONTEXT_ARTIFACT.md`); note any required follow-up if the artifact is missing or stale.
- [ ] Monitoring state file location confirmed (`--state-file` or `CORTEXDX_MONITOR_STATE`) when touching scheduler/monitoring logic.
- [ ] Documentation updated (README/vision/AGENTS) if flags, workflows, or governance behaviors changed.

## Screenshots / Evidence

- Optional: attach CLI output, screenshots, or links to reports that help reviewers.
