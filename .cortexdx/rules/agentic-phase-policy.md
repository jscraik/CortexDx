# Agentic Phase Policy (R→G→F→REVIEW) — ArcTDD-Compatible

**Goal:** Agents auto-progress through phases with zero HITL until **REVIEW**.  
**Binding:** ArcTDD v2025.11 (G0–G7), Charter Guardrails (#1–#10)

---

## Phase machine

### R (Red) — write failing tests; plan minimal pass

**Allowed**

- Planning & test authoring; minimal scaffold code
- Time Freshness Guard normalization
- Academic research enhancement via MCP/HTTP connectors
- Vibe Check (Oversight) after research, before any writes/long runs
- Local Memory parity updates

**Forbidden**

- `human_input` (except Ask-First ≤3 clarifications in **G0/G1**)
- Production deploys, merges

**Auto-advance → G when**

- New acceptance/unit tests **fail first**, then **pass** on the next commit
- `TIME_FRESHNESS:OK tz=<IANA> today=<YYYY-MM-DD>` token present
- Oversight log (`brAInwav-vibe-check`) stored in `logs/vibe-check/`

---

### G (Green) — implement to pass

**Allowed**

- Code to satisfy tests; refactor strictly to green
- Live model probes: `pnpm models:health && pnpm models:smoke` (Frontier/MLX/Ollama)
- Security scanners (Semgrep, OSV) and secret scans (gitleaks)
- **Structured outputs required** for any machine-consumed LLM result (JSON-Schema or tool/function calling)

**Forbidden**

- `human_input` (Ask-First clarifications remain confined to G0/G1)

**Auto-advance → F when**

- `pnpm test` **passes**
- Coverage ≥ **90%** global & **95%** changed lines
- Mutation ≥ **90%** (where enabled)
- Latest model-health log includes engine, model IDs, vector dims/norms, P95 latency

---

### F (Finished) — refactor, docs, a11y, supply-chain, structure

**Allowed**

- Non-behavioral refactors; documentation
- A11y audits (axe/jest-axe/Playwright)
- SBOM & provenance: **CycloneDX 1.7** + **SLSA v1.1**; **Cosign v3 bundle** verify
- Structure/contract guard, Observability checks

**Forbidden**

- `human_input` (Ask-First allowance does not apply here)

**Auto-advance → REVIEW when**

- A11y reports attached
- Security scanners: Semgrep (blockers), OSV clean, gitleaks zero secrets
- `pnpm structure:validate` **passes**
- `pnpm models:health && pnpm models:smoke` evidence attached (**live** only)
- Local Memory parity entry appended (decisions/refactors)

---

### REVIEW — human-in-the-loop only here

**Allowed**

- `human_input` (HITL), reviewer checklist, approvals/waivers per Constitution
- Merge only when **all BLOCKERs** pass and evidence pointers resolve

**Merge gate requires**

- Evidence Triplet (milestone red→green proof, contract snapshot, reviewer JSON pointer)
- Trace Context proof (every governed log has `traceparent` + 32-hex `trace_id`)
- SBOM (CycloneDX 1.7), SLSA v1.1 provenance, Cosign v3 **bundle** verify logs
- A11y/security artifacts
- Reuse Ledger pointer

---

## Hard rules (normative)

1. **Ask-First ≤3 (G0/G1 only).** Each question must enumerate options + consequences. All Ask-First events are logged as `human_input:ask_first`.
2. **No HITL before REVIEW.** Any other `human_input` pre-REVIEW is a violation unless a time-boxed waiver exists.
3. **Structured outputs required.** Any model output that drives tools/files/network **must** be function/tool-calling or conform to a JSON-Schema, with validation on receipt.
4. **Observability.** All charter-governed logs carry `[brAInwav]`, `brand:"brAInwav"`, ISO-8601 timestamp, `trace_id` (32 lower-hex), and **HTTP `traceparent`** for correlation. Missing fields fail gates.
5. **Supply-chain.** Generate **CycloneDX 1.7** SBOM; produce **SLSA v1.1** provenance; sign/verify with **Cosign v3 bundle**.
6. **Identity & secrets.** CI authenticates to cloud via **OIDC/WIF** only. Secrets are fetched at runtime using the **1Password CLI** (`op`); never persisted.
7. **Hybrid models — live only.** No stubs/recordings/dry-runs for embeddings/rerankers/generation. Frontier/MLX/Ollama health logs required.
8. **A11y baseline.** WCAG 2.2 AA (ISO/IEC 40500:2025).

---

## Evidence tokens (CI scans logs for these)

- `AGENTS_MD_SHA:<sha>`  
- `PHASE_TRANSITION:<from>-><to>`  
- `brAInwav-vibe-check`  
- `TIME_FRESHNESS:OK tz=<tz> today=<yyyy-mm-dd>`  
- `MODELS:LIVE:OK engine=<mlx|ollama|frontier> model=<id> dims=<n> norm≈<v> latency_ms=<n>`  
- `A11Y_REPORT:OK`  
- `STRUCTURE_GUARD:OK`  
- `COVERAGE:OK CHANGED_LINES:OK MUTATION:OK`  
- `MEMORY_PARITY:OK`  
- `TRACE_CONTEXT:OK`  
- `SUPPLY_CHAIN:OK sbom=cyclonedx@1.7 slsa=1.1 cosign=bundle`  

> **Phase rollback:** Requires a waiver; emit `PHASE_OVERRIDE:<from>-><to> link=<waiver-url>`
