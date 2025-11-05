# LLM Threat Controls — OWASP Top 10 Alignment (Cortex-OS)

**Status:** Authoritative reference for oversight mapping
**Scope:** Applies to all Cortex-OS agents, reviewers, and CI guardrails when assessing LLM-centric risk.

---

## How to use this document
- Reference the control IDs (`LLM0x`) in oversight findings, vibe-check evidence, risk assessments, and PR discussions.
- Each control lists mitigations expected within Cortex-OS. If a mitigation is missing, raise it as a BLOCKER unless a waiver exists.
- Map multiple IDs when a scenario spans more than one threat category.

---

## Control Catalog
| ID | OWASP LLM Top 10 | Cortex-OS Mitigations |
|----|------------------|-----------------------|
| LLM01 | LLM01: Prompt Injection | Strict input validation (Zod schemas), sandboxed tool execution, allow-list prompts, vibe-check approval before side effects. |
| LLM02 | LLM02: Data Leakage | Data minimization, differential redaction via observability filters, mandatory access reviews, encrypted storage, automated PII scanning. |
| LLM03 | LLM03: Model Theft | Authenticated API gateways, rate limiting, watermarking for generated artifacts, signed inference manifests. |
| LLM04 | LLM04: Supply Chain | SBOM + Cosign v3 bundles, dependency review, reproducible builds, SLSA provenance, package integrity checks. |
| LLM05 | LLM05: Insecure Plugins | Plugin registry attestation, contract testing, capability scoping, kill-switch toggles in orchestration layer. |
| LLM06 | LLM06: Excessive Agency | Human-in-the-loop gating (vibe-check), action throttles, deterministic plans ≤ 7 steps, mandatory recap logging. |
| LLM07 | LLM07: Sensitive Output Handling | Output classifiers, policy-based redaction, watermark detection, reviewer approval for regulated content. |
| LLM08 | LLM08: Inadequate Monitoring | OpenTelemetry traces with `trace_id`, audit log retention, anomaly detection dashboards, run manifest archives. |
| LLM09 | LLM09: Model Poisoning | Dataset provenance attestations, hash pinning for training corpora, data quality scoring, quarantine pipelines. |
| LLM10 | LLM10: Insecure Defaults | Secure-by-default configs, least-privilege credentials (OIDC/WIF), disabled legacy endpoints, documented escalation paths. |

---

## Reporting Template
Use the following snippet in oversight notes or PR comments:

```markdown
**LLM Threat Controls**
- LLM0x — <summary>
- Mitigation evidence: <file://path#Lstart-Lend or log reference>
```

---

## References
- [OWASP Top 10 for Large Language Model Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- `/.cortex/rules/vibe-check.md`
- `/.cortex/rules/agentic-coding-workflow.md`
