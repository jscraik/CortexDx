---
status: "onboarding"
audience: "new contributors"
last_updated: "2025-11-16"
reading_time: "10 minutes"
---

# CortexDx Governance Quick Start

**Welcome!** This guide helps you understand and work with CortexDx's governance system in 10 minutes.

## TL;DR - The Essentials

**Before you start coding:**
1. Read `AGENTS.md` (5 min) - Your operational rulebook
2. Choose your workflow tier: `fix` (small), `feature` (new), or `refactor` (internal)
3. Run `pnpm lint && pnpm test && pnpm build` locally before pushing

**Before you submit PR:**
1. Evidence must include: tests (red→green), coverage ≥90%, security scans clean
2. Complete code review checklist: `.cortexdx/rules/code-review-checklist.md`
3. Check for `[BLOCKER]` items - these MUST pass

**Golden Rule:** If a tool is missing, check `.cortexdx/MISSING_TOOLS.md` for workarounds

---

## Understanding the Governance Hierarchy

```
1. AGENTS.md (root)          ← Start here - your operational guide
2. .cortexdx/rules/          ← Detailed policies (17 docs)
   ├── constitution.md       ← Core principles (read second)
   ├── vision.md             ← North star & architecture
   ├── agentic-coding-workflow.md  ← How to work (Gates G0-G10)
   └── code-review-checklist.md    ← What reviewers check
3. Package AGENTS.md         ← Package-specific rules (if exists)
```

**Read in order:** AGENTS.md → Constitution → Vision → Your chosen workflow tier guide

---

## Three Workflow Tiers (Pick One)

### 🔧 Tier 1: Fix
**When:** Bug fixes, typos, small corrections (no contract changes)
**Time:** 30-90 minutes
**Required:**
- Tests for the bug (failing → passing)
- Coverage ≥90% on changed lines
- Security scans clean
- Evidence: test output, coverage report

**Gates:** G0 (setup), G1 (quick research), G2 (≤7 step plan), G3-G5 (test/implement/verify), G7 (CI)

**Example:** Fix incorrect error message, correct calculation bug

---

### 🎨 Tier 2: Feature
**When:** New capability, new API, new contract
**Time:** 2-8 hours (may span multiple arcs)
**Required:**
- Full research (academic sources, Wikidata, design docs)
- Design artifacts (diagrams, SRS)
- Tests + coverage + mutation ≥90%
- A11y verification (WCAG 2.2 AA)
- Security scans + SBOM
- Vibe check approval
- Evidence: full G0-G10 artifacts

**Gates:** All G0-G10 gates

**Example:** Add new diagnostic plugin, new MCP tool, new report format

---

### 🔄 Tier 3: Refactor
**When:** Internal changes, no public contract change
**Time:** 1-4 hours
**Required:**
- Contract snapshots (before/after proof of no public change)
- Tests maintain coverage
- Performance deltas documented
- Evidence: contract diff, perf benchmarks

**Gates:** G0-G4, G5-G7, G9-G10 (skip external research G1)

**Example:** Optimize internal algorithm, rename private functions, restructure modules

---

## The Phase Machine (How Work Flows)

All work follows: **R → G → F → REVIEW**

```
R (Red)     → Write failing tests, plan implementation
              Auto-advance when: tests fail then pass

G (Green)   → Implement to make tests pass
              Auto-advance when: coverage ≥90%, tests pass

F (Finished)→ Refactor, docs, security scans, SBOM
              Auto-advance when: all gates pass

REVIEW      → Human review, approval (ONLY place for human input)
              Merge when: checklist complete, BLOCKERs pass
```

**Key Rule:** No human input (`human_input`) allowed before REVIEW phase

---

## Your First PR Checklist

### Before You Code
- [ ] Read `AGENTS.md` (entire file - it's mandatory)
- [ ] Pick tier: fix / feature / refactor
- [ ] Create task folder: `~/Changelog/<slug>/`
- [ ] Write acceptance test (it should fail)

### While Coding
- [ ] Keep functions ≤40 lines
- [ ] Use named exports only (no `export default`)
- [ ] No `any` in production code
- [ ] Write tests BEFORE implementation (TDD)
- [ ] Run `pnpm lint && pnpm test` frequently

### Before PR
- [ ] All tests pass: `pnpm test`
- [ ] Coverage ≥90%: Check test output
- [ ] Lint clean: `pnpm lint` (zero warnings)
- [ ] Build succeeds: `pnpm build`
- [ ] Security clean: `pnpm security:semgrep && pnpm security:gitleaks`

### In PR Description
- [ ] Link to acceptance test
- [ ] Evidence attached (test output, coverage, scans)
- [ ] Tier clearly stated
- [ ] Checklist from `.cortexdx/rules/code-review-checklist.md` completed

---

## Common Scenarios & Decision Trees

### "Which tier should I use?"

```
Does it change public API/contract?
├─ YES → Did contract break existing clients?
│         ├─ YES → Feature (Tier 2) + breaking change ADR
│         └─ NO  → Feature (Tier 2)
└─ NO  → Is it fixing a bug?
          ├─ YES → Fix (Tier 1)
          └─ NO  → Refactor (Tier 3)
```

### "A governance tool is missing - what do I do?"

```
Check .cortexdx/MISSING_TOOLS.md
├─ Tool has workaround listed?
│   ├─ YES → Use workaround, document in PR
│   └─ NO  → Request waiver using template
└─ Tool priority = HIGH?
    └─ YES → Flag for urgent implementation
```

### "My PR is blocked by a governance rule"

```
Is the rule marked [BLOCKER]?
├─ YES → Must fix OR request waiver
│         ├─ Fix possible? → Fix it
│         └─ Fix not possible → Request waiver (.cortexdx/waivers/TEMPLATE.waiver.json)
└─ NO ([MAJOR] or [MINOR]) → Can request waiver or create follow-up task
```

### "How do I request a waiver?"

```
1. Copy template: .cortexdx/waivers/TEMPLATE.waiver.json
2. Fill required fields:
   - rule_id: Which rule you need to waive
   - justification: Why you need waiver (≥50 chars)
   - compensating_controls: What you'll do instead
   - expiration: When waiver expires (or "permanent")
3. Get approval:
   - Temporary (≤30 days): Tech Lead
   - Temporary (>30 days): Maintainer
   - Permanent: Maintainer + Architecture review
4. Link waiver in PR description
```

---

## Quick Reference: Required Evidence by Tier

| Evidence Type | Tier 1 (Fix) | Tier 2 (Feature) | Tier 3 (Refactor) |
|--------------|--------------|------------------|-------------------|
| Acceptance test | ✅ Required | ✅ Required | ✅ Required |
| Research artifacts | ❌ Skip | ✅ Required (academic) | ⚠️ Internal only |
| Design docs | ❌ Skip | ✅ Required (SRS, diagrams) | ⚠️ Contract snapshots |
| Coverage ≥90% | ✅ Changed lines | ✅ Global + changed | ✅ Maintained |
| Mutation ≥90% | ⚠️ If enabled | ✅ Required | ✅ Required |
| Security scans | ✅ Required | ✅ Required | ✅ Required |
| A11y evidence | ⚠️ If UI changed | ✅ Required | ⚠️ If UI changed |
| SBOM | ⚠️ If deps changed | ✅ Required | ⚠️ If deps changed |
| Vibe check | ❌ Skip | ✅ Required | ❌ Skip |

---

## Troubleshooting Common Issues

### "My tests are failing in CI but pass locally"

**Likely causes:**
1. **Environment differences** - Check Node version matches (20.11.1)
2. **Missing env vars** - Secrets loaded locally but not in CI
3. **Race conditions** - Tests not deterministic

**Debug steps:**
```bash
# Check versions match
node --version  # Should be 20.11.1
pnpm --version  # Should be 9.12.2

# Run with same flags as CI
CORTEXDX_RUN_INTEGRATION=0 pnpm test

# Check for non-deterministic tests
pnpm test --run --reporter=verbose
```

---

### "Coverage is below 90%"

**Quick fixes:**
```bash
# See what's uncovered
pnpm test --coverage

# Look for untested branches
# Add tests for:
# - Error paths
# - Edge cases (null, empty, max values)
# - Async error handling
```

**Still stuck?**
- Check if you're testing the right files
- Ensure test imports match implementation
- Look for conditional logic (if/else) without both paths tested

---

### "Lint is failing"

**Common issues:**
```bash
# Run lint locally
pnpm lint

# Common failures:
# - Unused imports → Remove them
# - Function >40 lines → Break into smaller functions
# - Missing types → Add explicit types
# - `any` in production → Use specific types

# Auto-fix what's possible
pnpm lint:fix
```

---

### "Security scan is blocking my PR"

**Steps:**
1. **Identify the finding:**
   ```bash
   pnpm security:semgrep  # Check Semgrep findings
   pnpm security:gitleaks # Check for secrets
   ```

2. **Fix or waive:**
   - Real issue → Fix it
   - False positive → Document why + request waiver

3. **Common semgrep issues:**
   - Unsafe `eval()` use → Find safer alternative
   - SQL injection risk → Use parameterized queries
   - Missing `AbortSignal` → Add cancellation support

---

### "I need a tool that doesn't exist"

**Check the inventory:**
```bash
# See what's missing and workarounds
cat .cortexdx/MISSING_TOOLS.md
```

**If HIGH priority and no workaround:**
1. Create issue: "Implement [tool name]"
2. Request temporary waiver
3. Document manual workaround in PR
4. Link waiver: `.cortexdx/waivers/TEMPLATE-missing-tool.waiver.json`

---

## Grace Period Status (Current)

**Reuse-First Attestation:**
- **Status:** IN GRACE PERIOD (2025-11-16)
- **Grace ends:** 2025-12-10
- **Current mode:** WARN/MAJOR (merge allowed with remediation plan)
- **After 2025-12-11:** BLOCKER (merge blocked without evidence)

**What to do:**
- Start preparing reuse evidence now
- Use template: `.cortexdx/templates/reuse-evaluation-template.md`
- Create remediation ticket if not ready
- Reference grace period waiver template

---

## Getting Help

### "I'm stuck on governance"
1. **Check docs first:**
   - This guide (you are here)
   - `.cortexdx/MISSING_TOOLS.md` - Tool workarounds
   - `.cortexdx/waivers/README.md` - Waiver process

2. **Ask in channels:**
   - Slack: `#governance`
   - Slack: `#dev-help`

3. **Tag maintainers:**
   - @jamiescottcraik (Governance maintainer)

### "I found a governance issue"
Create issue with label `governance` describing:
- What's unclear/broken
- Your expected behavior
- Suggested fix (if any)

### "I want to propose a governance change"
1. Create ADR (Architecture Decision Record)
2. Include rationale and impact analysis
3. Get maintainer approval
4. Update governance docs
5. Announce changes

---

## Essential Commands Reference

```bash
# Development
pnpm lint              # Lint code (must pass with 0 warnings)
pnpm test              # Run tests
pnpm build             # Build packages
pnpm dev               # Run in dev mode

# Security
pnpm security:semgrep  # Run Semgrep security scan
pnpm security:gitleaks # Check for secrets
pnpm sbom              # Generate SBOM

# Documentation
pnpm docs:validate     # Validate documentation
pnpm docs:lint         # Lint markdown files

# Project-specific (cortexdx package)
cd packages/cortexdx
pnpm test:integration  # Run integration tests
pnpm test:bench        # Run benchmarks
pnpm doctor            # Run diagnostics
```

---

## What Makes a Good PR?

### ✅ Good PR Example

```markdown
## Summary
Fix incorrect severity calculation in diagnostic report plugin

## Tier
Fix (Tier 1)

## Changes
- Corrected severity threshold logic in src/plugins/diagnostic.ts
- Added test case for edge case (0 findings)
- Updated test snapshots

## Evidence
- Tests: ✅ Pass (see test output below)
- Coverage: ✅ 94% changed lines
- Lint: ✅ Clean
- Security: ✅ No findings
- Build: ✅ Success

## Checklist
- [x] Acceptance test failing → passing
- [x] Coverage ≥90% on changed lines
- [x] Lint clean (0 warnings)
- [x] Security scans clean
- [x] Build succeeds
```

### ❌ Bad PR Example

```markdown
## Summary
Fixed stuff

## Changes
Updated some files

[No evidence, no tier, no checklist]
```

---

## Next Steps After This Guide

1. **Read `AGENTS.md`** - Full operational instructions (mandatory)
2. **Pick your first task** - Start with Tier 1 (fix) for practice
3. **Set up your environment** - `mise install && pnpm install`
4. **Make your first PR** - Use this guide as reference

---

## Quick Links

- **Main Governance:** [AGENTS.md](../AGENTS.md)
- **Constitution:** [.cortexdx/rules/constitution.md](.cortexdx/rules/constitution.md)
- **Coding Workflow:** [.cortexdx/rules/agentic-coding-workflow.md](.cortexdx/rules/agentic-coding-workflow.md)
- **Code Review Checklist:** [.cortexdx/rules/code-review-checklist.md](.cortexdx/rules/code-review-checklist.md)
- **Missing Tools:** [.cortexdx/MISSING_TOOLS.md](.cortexdx/MISSING_TOOLS.md)
- **Waiver Process:** [.cortexdx/waivers/README.md](.cortexdx/waivers/README.md)

---

**Remember:** Governance exists to maintain quality and consistency. When in doubt, ask for help rather than guessing! 🎯
