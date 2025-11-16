---
status: "authoritative"
scope: "Governance waiver process"
maintainer: "@jamiescottcraik"
last_updated: "2025-11-16"
---

# Governance Waivers

This directory contains approved waivers for governance policy exceptions.

## Purpose

Waivers allow temporary or permanent exceptions to governance rules when:
- Technical constraints make compliance impossible
- Business requirements necessitate an exception
- Compensating controls provide equivalent protection
- The rule is being deprecated or updated

## Waiver Types

### Temporary Waiver
- **Duration**: ≤30 days by default (can be extended with justification)
- **Use**: Short-term exceptions during transitions or urgent fixes
- **Requires**: Remediation plan with specific completion date

### Permanent Waiver
- **Duration**: Indefinite (subject to periodic review)
- **Use**: Systemic exceptions where the rule doesn't apply
- **Requires**: Strong justification and compensating controls

### Grace Period Waiver
- **Duration**: Tied to specific transition period
- **Use**: During governance rule rollouts (e.g., reuse-first attestation)
- **Requires**: Preparation plan for full compliance

## Waiver Process

### 1. Request Waiver
Create waiver file from template in this directory.

### 2. Complete Waiver Details
Fill in all required fields in the JSON template.

### 3. Obtain Approval
Required approval level based on waiver type and duration.

### 4. Link to PR/Issue
Reference waiver in PR description and checklist.

### 5. Monitor & Review
Track in ACTIVE_WAIVERS.md and review periodically.

## File Naming Convention

Format: `[YYYY-MM-DD]-[rule-id]-[short-description].waiver.json`

Examples:
- `2025-11-16-reuse-evidence-transition.waiver.json`
- `2025-11-20-legacy-api-exception.waiver.json`

## See Also

- [Constitution - Amendment Process](../rules/constitution.md)
- [Code Review Checklist](../rules/code-review-checklist.md)
