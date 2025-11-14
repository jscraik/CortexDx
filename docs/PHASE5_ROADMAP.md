# Phase 5 Roadmap (Preview)

This checklist captures the concrete actions required for the next milestone. Each item links back to the outstanding objectives (OWASP ASVS/MITRE ATLAS, Auth0 upgrades, report manager/LangGraph workflow, SBOM pipeline, tutorial CLI polish).

## 1. OWASP ASVS / MITRE ATLAS Coverage

1. Add ASVS + ATLAS mapping tables under `packages/cortexdx/security/` to track probe coverage.
2. Extend the `security` suite to emit evidence pointers tagged with the relevant control IDs.
3. Update CI to fail when a high-severity ASVS/ATLAS control is untested (gated behind `CORTEXDX_ENFORCE_SECURITY=1`).

## 2. Auth0 Upgrades

1. Implement device-code flow fallback in `src/auth/oauth-auth.ts`.
2. Add integration tests for dual-auth (MCP API key + Auth0 bearer) under `tests/oauth-authentication.spec.ts`.
3. Document environment toggles (`CORTEXDX_AUTH0_DEVICE_CODE`, etc.) in `docs/AUTH0_SETUP.md`.

## 3. Report Manager + LangGraph Workflow

1. Introduce `packages/cortexdx/src/report/manager.ts` to collect, de-dupe, and persist findings from orchestrated runs.
2. Wire the manager into `runOrchestrate` so `--research` and LangGraph outputs can be exported together.
3. Provide a CLI flag (`--report-out <dir>`) that dumps a consolidated JSON/Markdown snapshot after every LangGraph workflow.

## 4. SBOM Pipeline

1. Add `pnpm sbom` (Syft/ORT wrapper) and ensure it runs inside CI.
2. Store SBOM artifacts under `reports/sbom/<timestamp>` and document review steps in `docs/SECURITY.md`.
3. Block releases if the SBOM includes unknown licenses or unreviewed CVEs.

## 5. Tutorial CLI Enhancements

1. Replace the placeholder content in `runCreateTutorial` with AI-assisted steps seeded by the new academic research probe.
2. Add deterministic fixtures under `tests/tutorial-cli.spec.ts` covering beginner/intermediate/expert flows.
3. Extend the output to include research highlights + DeepContext references for every generated exercise.

> Keep this file up to date as each item lands—Phase 5 gating reviews will use it as the single source of truth.
