# AGENTS.md Review Feedback - Implementation Plan

**Date:** 2025-10-20  
**Reviewer Feedback:** Applied from user review  
**Status:** Implementation guide for maintainer

---

## Changes Applied

### 1. ✅ Added Glossary (Section 0.2)

```markdown
## 0.2) Glossary (Quick Reference)

**Arc** — A vertical slice of work spanning API → logic → store → tests, completed in 2–5 commits and 45–120 minutes.  
**Step Budget** — Maximum of 7 discrete plan/act iterations per arc before splitting into a new arc.  
**Evidence Triplet** — Three required artifacts per arc: (1) milestone test path (red→green proof), (2) contract snapshot (types/schema/route), (3) reviewer JSON pointer.  
**North-Star Test** — An acceptance test written before implementation that proves the feature is real; must fail initially, pass upon completion.  
**Preflight Guards** — Six mandatory checks before file writes/network calls: vibe-check, model health, connector health, trace context, SBOM, identity gate.  
**Session Hygiene** — 50-minute work / 10-minute reset cadence with context diet and hard reset triggers.
```

---

## Changes Pending (Require Full File Edit)

### 2. Grepable Rule IDs [AGENTS-XXX-NNN]

**Sections to update:**

```markdown
## 5) Boundaries & Interfaces [AGENTS-BND-005]
## 11) Oversight Gate (formerly "Vibe Check MCP") [AGENTS-PRV-002]
## 12) Observability & Telemetry [AGENTS-OBS-006]
## 20) Anti-Patterns (will fail CI) [AGENTS-STY-007]
## 25) Hybrid Model Solution — Live Only (MLX / Ollama / Frontier) [AGENTS-HMS-003]
```

### 3. Section 6 - Add Quickstart

```markdown
## 6) Build, Run, Verify

**Quickstart (3 essentials for daily workflow)**

```bash
pnpm dev                   # Start development servers
pnpm build:smart           # Build affected packages only
pnpm test:smart            # Run affected tests only
```

**Bootstrap**
...
```

### 4. Section 11 - Enhanced Oversight Gate

```markdown
## 11) Oversight Gate (formerly "Vibe Check MCP") [AGENTS-PRV-002]

* All agents MUST call the Oversight tool **`vibe_check`** after planning and **before file writes, network calls, or long executions**.
* **Config:** `VIBE_CHECK_HTTP_URL` (default `http://127.0.0.1:2091`)
* **Required headers:** `Accept: application/json, text/event-stream`
* **CLI wrapper:** `pnpm oversight:vibe-check --goal "<task>" --plan "<steps>" --session <id>`
* **Evidence path:** Persist response under `logs/vibe-check/<task>.json`
* Logs/errors MUST include `brand:"brAInwav"`.
* Runbook: see `docs/runbooks/vibe-check.md` for payload details, troubleshooting, and evidence requirements.
* Evidence: PRs MUST attach logs containing `brAInwav-vibe-check` at plan→act gates; CI blocks otherwise.
```

### 5. Section 12 - Observability with AI Provenance Schema

```markdown
## 12) Observability & Telemetry [AGENTS-OBS-006]

* OpenTelemetry traces/logs/metrics; Prometheus `/metrics`; structured logs with `brand:"brAInwav"`, request/run IDs.
* Performance budgets (bundle/time/memory) enforced in CI; exceptions documented with waivers (§27).
* **AI provenance:** maintain `AI_CONTRIB_LOG.yaml` at `.cortexdx/audit/ai/AI_CONTRIB_LOG.yaml`
  ```yaml
  - commit: <hash>
    model: <name>
    params: {temperature: 0.7, max_tokens: 2000}
    tokens: {prompt: 1234, completion: 567}
    timestamp: 2025-10-20T12:00:00Z
  ```
* **CI audit:** run `pnpm audit:observability` to regenerate `/reports/observability-adoption.json` before merge.
```

### 6. Section 19 - Inline Port Registry

```markdown
## 19) Environments & Ports

**Key MCP/Memory ports** (inline for quick reference):

```
CORTEX_MCP_PORT=3024
LOCAL_MEMORY_MCP_PORT=3026
MEMORY_API_PORT=3028
PIECES_OS_PORT=39300
OLLAMA_PORT=11434
REDIS_PORT=6379
VSCODE_LSP_PORT=3008
```

Verify `.well-known/mcp.json` and port congruence (3024/3026/3028/39300) in PRs.
```

### 7. Section 20 - Enhanced Anti-Patterns

```markdown
## 20) Anti-Patterns (will fail CI) [AGENTS-STY-007]

* Default exports; > 40-line functions; promise chains without `await`.
* TypeScript `any` in production code (outside tests/justified shims).
* Missing brand in logs/errors; fake metrics/telemetry; placeholder adapters.
* Cross-domain imports; skipping memory/context persistence.
* Unpinned dependency bumps; bypassing lockfiles; ignoring Governance mandates.
* Raising `pnpm` `childConcurrency` or Nx parallelism beyond documented mitigations without evidence.
* **"Will be wired later", "follow-up" in prod paths; TODO/FIXME/HACK in production code.**
```

---

## New CI Enforcement Scripts Needed

### Script 1: `scripts/governance/agents-guard.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Charter SHA-256 and Rule ID Validation
 * [AGENTS-CHK-001] Charter Hash Verification
 * [AGENTS-RID-002] Rule ID Lint
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const CHARTER_PATH = '.cortexdx/rules/CHARTER_FRAGMENT.md';
const AGENTS_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  '.github/copilot-instructions.md',
  'packages/agents/AGENTS.md',
  '.github/instructions/memories.instructions.md'
];

// [AGENTS-CHK-001] Verify Charter SHA-256 matches across all files
function verifyCharterSHA() {
  const charterContent = readFileSync(CHARTER_PATH, 'utf-8');
  const actualSHA = createHash('sha256').update(charterContent).digest('hex');
  
  console.log(`[brAInwav] Charter Fragment SHA-256: ${actualSHA}`);
  
  let mismatches = 0;
  for (const file of AGENTS_FILES) {
    const content = readFileSync(file, 'utf-8');
    const match = content.match(/Charter SHA-256.*`([a-f0-9]+)`/);
    if (!match || match[1] !== actualSHA) {
      console.error(`[brAInwav] ❌ SHA mismatch in ${file}: expected ${actualSHA}, found ${match?.[1] || 'none'}`);
      mismatches++;
    }
  }
  
  if (mismatches > 0) {
    console.error(`[brAInwav] ❌ ${mismatches} file(s) have incorrect Charter SHA-256`);
    process.exit(1);
  }
  
  console.log(`[brAInwav] ✅ All files reference correct Charter SHA-256`);
}

// [AGENTS-RID-002] Verify Rule IDs are present and unique
function verifyRuleIDs() {
  const content = readFileSync('AGENTS.md', 'utf-8');
  const ruleIDs = content.match(/\[AGENTS-[A-Z]+-\d+\]/g) || [];
  
  console.log(`[brAInwav] Found ${ruleIDs.length} rule IDs`);
  
  // Check for minimum count (should have at least 10 for core sections)
  if (ruleIDs.length < 10) {
    console.error(`[brAInwav] ❌ Expected at least 10 rule IDs, found ${ruleIDs.length}`);
    process.exit(1);
  }
  
  // Check for duplicates
  const unique = new Set(ruleIDs);
  if (unique.size !== ruleIDs.length) {
    console.error(`[brAInwav] ❌ Duplicate rule IDs found`);
    process.exit(1);
  }
  
  console.log(`[brAInwav] ✅ Rule IDs valid (${unique.size} unique)`);
}

// Main
console.log('[brAInwav] 🛡️  Agents Guard - Charter & Rule ID Validation');
verifyCharterSHA();
verifyRuleIDs();
console.log('[brAInwav] ✅ All checks passed');
```

### Script 2: Add to `package.json`

```json
{
  "scripts": {
    "agents:guard": "tsx scripts/governance/agents-guard.ts",
    "audit:observability": "tsx scripts/ci/audit-observability.ts"
  }
}
```

### Script 3: Add to CI (`.github/workflows/governance.yml`)

```yaml
- name: Charter & Rule ID Guard
  run: pnpm agents:guard
  
- name: Observability Audit
  run: pnpm audit:observability
```

---

## Summary of Improvements

| # | Improvement | Status | Rule ID |
|---|-------------|--------|---------|
| 1 | Glossary at top | ✅ Applied | N/A |
| 2 | Grepable rule IDs | ⏳ Pending | AGENTS-XXX-NNN |
| 3 | Quickstart in §6 | ⏳ Pending | N/A |
| 4 | Oversight headers in §11 | ⏳ Pending | AGENTS-PRV-002 |
| 5 | AI provenance schema in §12 | ⏳ Pending | AGENTS-OBS-006 |
| 6 | Inline ports in §19 | ⏳ Pending | N/A |
| 7 | TODO/FIXME/HACK in §20 | ⏳ Pending | AGENTS-STY-007 |
| 8 | Charter SHA guard script | ⏳ Pending | AGENTS-CHK-001 |
| 9 | Rule ID lint script | ⏳ Pending | AGENTS-RID-002 |
| 10 | Observability audit script | ⏳ Pending | AGENTS-OBS-006 |

---

## Next Steps for Maintainer

1. Review and approve this implementation plan
2. Apply pending changes to `AGENTS.md` (items 2-7)
3. Create `scripts/governance/agents-guard.ts` (item 8-9)
4. Create `scripts/ci/audit-observability.ts` (item 10)
5. Wire both scripts into CI
6. Test locally: `pnpm agents:guard`
7. Update Charter SHA-256 in all files if AGENTS.md changes
8. Commit with message: "feat(governance): apply review feedback - rule IDs, glossary, inline refs"

**Estimated effort:** 30-45 minutes
