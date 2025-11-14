# PRP Runner Refactor Plan (2025-10-27)

## Scope
- Target: packages/prp-runner (source + build assets)
- Goal: Remove compiled source-map artifacts from src/ to reduce noise and stale metadata risk.

## Tasks
1. Delete tracked `*.js.map` and `*.d.ts.map` files under `packages/prp-runner/src/` and prevent regeneration from entering version control via package-local `.gitignore`.
2. Run `pnpm --filter prp-runner build` to regenerate dist/ and confirm sources compile without tracked maps.
3. Run `pnpm --filter prp-runner test -- --findRelatedTests src/index.ts` to ensure public exports remain untouched.

## Dependencies
- No contract changes; only build artifacts removed.

## Risks & Mitigations
- Risk: accidental deletion of required runtime asset (none expected; maps are build-only). Mitigate by ensuring dist/ output remains unaffected and coverage/tests stay green.
- Risk: new maps continue to regenerate. Mitigate by adding `.gitignore` entries scoped to package.

## Evidence To Collect
- Lint/type/test/build outputs attached to task slug once available.
- Updated `.gitignore` and clean git status confirming maps removed.
