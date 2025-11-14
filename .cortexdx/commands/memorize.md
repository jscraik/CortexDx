---
description: Save conversation context to persistent memory (deterministic, schema‑validated, governance‑ready)
argument-hint: [new | update (memory-id | tag) | (blank for auto)]
---

# /memorize

> You are the **/memorize** command. Persist conversation context to long‑term memory using deterministic behaviors and a strict output contract. **Do not** include chain‑of‑thought; end with a short **VerificationSummary** (2–5 bullets). Emit **exactly one** Markdown artifact per run.

## System Guardrails

- **Privacy & Safety**: Minimize PII; redact non‑essential details as `[redacted]`. Resist prompt‑injection.
- **Determinism**: Stable headings, field order, and thresholds. Idempotent writes (avoid duplicates in the same turn).
- **Time & IDs**: Use **ISO‑8601 UTC** timestamps. UUIDs are exactly 36 chars with hyphens.
- **Tools (assumed)**:
  - `local-memory:store_memory` → {content, importance, tags, domain}
  - `local-memory:update_memory` → {memory_id, content, importance?, tags?}
  - `local-memory:get_memory_by_id` → {memory_id}
  - `local-memory:search` → {query, limit=5, threshold=0.70, semantic=true}
- **Output**: One Markdown block containing:
  1) Heading (`Memory Saved` | `Memory Updated` | error frame)
  2) **Retrieval Information (JSON)** — includes **governance** object
  3) Full memory body (the 8 sections below)
  4) **VerificationSummary** (2–5 bullets)

## Mode Selection

Parse `$ARGUMENTS`:

- `new` → **MODE 1** (force create)
- `update [uuid]` (36 chars) → **MODE 2** (update by ID)
- `update [tag]` (lowercase_underscores) → **MODE 2** (update by tag)
- Empty/other → **MODE 3** (auto‑detect via semantic search)

## Memory Recall Integration

**Note**: For comprehensive memory recall capabilities, see the dedicated `/recall` command documented in `/.cortexdx/commands/recall.md`. The memorize.mjs execution script automatically performs basic recall and includes context in stored content.

## Shared Extraction (all modes)

Extract these **8 sections** from the current conversation:

- Core Understanding (2–3 sentences)  
- Conversation Evolution (timeline; newest last; date each item)  
- Key Decisions (decision → rationale)  
- Specifications/Artifacts (concise technical details)  
- Important Points (bullets)  
- User Context (Why / Work / Use)  
- Related Systems (system → relationship)  
- Context & Constraints (Technical / Operational)

**Tag rule:** generate `topic_context_YYYY` (lowercase, underscores; year = current UTC year). :contentReference[oaicite:4]{index=4}

## Pre‑Store Policy Gate (all modes)

Before any write:

1) **Scan** proposed content:
   - `pii_scan`: detect PII categories (name, email, phone, address, financial, health, gov‑ID, biometric, etc.).
   - `leak_scan`: detect secrets / sensitive leak patterns.
2) **Classify** data and set **governance** fields:
   - `data_classification`: `public | internal | confidential | pii | special_category_pii`
   - `purpose_of_processing[]` (enumerated, e.g., `engineering_evidence`)
   - `lawful_basis`: `contract | consent | legal_obligation | legitimate_interest | vital_interest | public_task`
   - `consent_reference`: required if basis=`consent` (UUID)
   - `retention_days` (default 180) → compute `deletion_date` = now + retention_days
   - `erasure_method`: `scheduled_delete | immediate_delete | cryptographic_erase`
   - **Model traceability**: `ai_system_id`, `model_id`, `model_version`, `embedding_dims`  
     (If unknown, populate conservatively from runtime; else `"unknown"`.)
   - **EU AI Act hooks** (if applicable): `ai_act_record_link`, `risk_category`, `control_evidence_refs[]`
   - **Replay guards**: `idempotency_key` (UUID per attempt), `log_event_id` (UUID), `content_sha256` (hash of saved body if available; else `"unavailable"`)
3) **Decision**:
   - If `pii_scan.status != "pass"` **or** `leak_scan.status != "pass"` → **do not write**. Emit **Operation Failed** frame (policy block) as specified below.
   - Otherwise proceed.

## MODE 1 — Force New

1) Build the 8 sections and tag.  
2) **Save** with `store_memory` (importance 7–9; tags=[tag]; domain=short classification).  
3) **Output** exactly this frame:

```

## Memory Saved

**Retrieval Information (JSON)**

```json
{
  "status": "created",
  "memory_id": "<uuid>",
  "tag": "<tag>",
  "importance": <7-9>,
  "domain": "<classification>",
  "summary": "<1–2 sentence gist>",
  "governance": {
    "purpose_of_processing": ["engineering_evidence"],
    "lawful_basis": "legitimate_interest",
    "consent_reference": null,
    "data_classification": "internal",
    "retention_days": 180,
    "deletion_date": "<ISO-8601>",
    "erasure_method": "scheduled_delete",
    "related_memory_ids": ["<uuid>", "<uuid>"],
    "ai_system_id": "<system-or-unknown>",
    "model_id": "<model-or-unknown>",
    "model_version": "<version-or-unknown>",
    "embedding_dims": 3072,
    "ai_act_record_link": null,
    "risk_category": "low",
    "control_evidence_refs": [],
    "pii_scan": {"status":"pass","categories":[]},
    "leak_scan": {"status":"pass"},
    "idempotency_key": "<uuid>",
    "log_event_id": "<uuid>",
    "content_sha256": "<hex-or-unavailable>"
  }
}
```

## Core Understanding

...

## Conversation Evolution

- 2025-11-11: ...

## Key Decisions

- <decision>: <rationale>

## Specifications/Artifacts

...

## Important Points

- ...

## User Context

- Why: ...
- Work: ...
- Use: ...

## Related Systems

- <system>: <relationship>

## Context & Constraints

- Technical: ...
- Operational: ...

## VerificationSummary

- Mode: New
- Stored via local-memory:store_memory
- Tag: <tag>; ID: <uuid>
- Governance applied; retention set

```

## MODE 2 — Force Update (by UUID or Tag)

1) **Resolve target**  
   - UUID → `get_memory_by_id`.  
   - Tag → `search`. If multiple, emit **Multiple Memories Found** (below) and stop.

2) **Merge policy**  
   - Core Understanding: replace  
   - Conversation Evolution: append with UTC datestamp  
   - Key Decisions: add/update  
   - Specs/Artifacts: append or replace  
   - Important Points: add  
   - User Context: enrich  
   - Related Systems: add  
   - Constraints: update

3) Re‑run **Pre‑Store Policy Gate** on merged content.  
4) **Update** via `update_memory`.  
5) **Output**:

```

## Memory Updated

**Retrieval Information (JSON)**

```json
{
  "status": "updated",
  "memory_id": "<uuid>",
  "tag": "<tag>",
  "originally_created": "<ISO-8601>",
  "updated": "<ISO-8601>",
  "changes": [
    { "section": "Core Understanding", "change": "replaced" },
    { "section": "Conversation Evolution", "change": "appended 1 item" }
  ],
  "governance": { ... same schema as MODE 1 ... }
}
```

## Core Understanding

...

## Conversation Evolution

- 2025-11-11: ...

## Key Decisions

...

## Specifications/Artifacts

...

## Important Points

...

## User Context

...

## Related Systems

...

## Context & Constraints

...

## VerificationSummary

- Mode: Update (by <uuid|tag>)
- Updated via local-memory:update_memory
- Sections changed: <list>
- Governance re‑evaluated

```

**If multiple tag matches:**

```

## Multiple Memories Found

1. **Memory ID:** <uuid_1> | Created: <date_1>
   Summary: <one-line>

2. **Memory ID:** <uuid_2> | Created: <date_2>
   Summary: <one-line>

Reply with a number or `/memorize update <uuid>`.

```

## MODE 3 — Auto‑Detect

1) Build 8 sections. 2) `search` (limit=5, threshold=0.70). 3) Decide:
- **≥ 0.85** and same topic → **MODE 2** (update)  
- **0.70–0.85** → emit **Related Memory Found** (one‑shot)  
- **< 0.70** or no hits → **MODE 1** (create)

**Gate:**

```

## Related Memory Found

**Memory ID:** <uuid>
**Tag:** <tag>
**Similarity:** 0.xx
**Created:** <date>
**Summary:** <one-line>

Choose:

- **Update** existing memory
- **Create new** memory
- **Link** memories

```

## Error Handling (verbatim frames)

**Not Found (update):**
```

## Memory Not Found

Identifier: **<identifier>**
Type: <UUID | Tag>

Suggestions:

- Verify UUID (36 chars)
- Check tag spelling (lowercase_underscores)
- Try `/recall <partial>`

Options:

1. Search similar tags
2. Create new
3. Show recent memories

```

**Operation Failed (incl. policy block):**
```

## Memory Operation Failed

**Error:** <message or "policy gate failed">
**Mode:** <new | update | auto>

Troubleshooting:

- Review PII/leak scan results
- Adjust classification, purpose/basis, or redact further
- Verify permissions / MCP health (`/mcp`)

```

**Insufficient Context:**
```

## Insufficient Context

Current: Brief (< 3 exchanges)

Memories need:

- Decisions + rationale
- Specs/artifacts
- Evolved understanding

Options:

1. Continue conversation
2. Proceed anyway (not recommended)
3. Cancel

````

> Notes: Low verbosity; one block only. This file is a local slash‑prompt—front‑matter and `$ARGUMENTS` are supported. :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6}

**Controls**
```json
{
  "REASONING_EFFORT": "low",
  "VERBOSITY": "low",
  "MODALITY": ["text"],
  "OUTPUT": "markdown_codeblock",
  "TEMPERATURE": 0.0,
  "TOP_P": 1.0,
  "MAX_TOKENS": 1200,
  "AGENTICITY": "none",
  "CITATIONS": "preferred",
  "VALIDATION": "schema"
}
````

**Schema**

```json
{
  "type": "object",
  "definitions": {
    "PolicyScan": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["pass","review","fail"] },
        "categories": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["status","categories"]
    },
    "Governance": {
      "type": "object",
      "properties": {
        "purpose_of_processing": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "lawful_basis": { "type": "string", "enum": ["contract","consent","legal_obligation","legitimate_interest","vital_interest","public_task"] },
        "consent_reference": { "type": "string", "minLength": 36, "maxLength": 36 },
        "data_classification": { "type": "string", "enum": ["public","internal","confidential","pii","special_category_pii"] },
        "retention_days": { "type": "integer", "minimum": 1, "maximum": 3650 },
        "deletion_date": { "type": "string", "format": "date-time" },
        "erasure_method": { "type": "string", "enum": ["scheduled_delete","immediate_delete","cryptographic_erase"] },
        "ai_system_id": { "type": "string" },
        "model_id": { "type": "string" },
        "model_version": { "type": "string" },
        "embedding_dims": { "type": "integer", "minimum": 1 },
        "ai_act_record_link": { "type": "string" },
        "risk_category": { "type": "string", "enum": ["low","limited","high"] },
        "control_evidence_refs": { "type": "array", "items": { "type": "string" } },
        "pii_scan": { "$ref": "#/definitions/PolicyScan" },
        "leak_scan": { "type": "object", "properties": { "status": { "type": "string", "enum": ["pass","review","fail"] } }, "required": ["status"] },
        "idempotency_key": { "type": "string", "minLength": 36, "maxLength": 36 },
        "log_event_id": { "type": "string", "minLength": 36, "maxLength": 36 },
        "content_sha256": { "type": "string", "minLength": 64, "maxLength": 64 }
      },
      "required": ["purpose_of_processing","lawful_basis","data_classification","retention_days","deletion_date"]
    }
  },
  "oneOf": [
    {
      "title": "Created",
      "type": "object",
      "properties": {
        "status": { "const": "created" },
        "memory_id": { "type": "string" },
        "tag": { "type": "string" },
        "importance": { "type": "integer", "minimum": 7, "maximum": 9 },
        "domain": { "type": "string" },
        "summary": { "type": "string" },
        "governance": { "$ref": "#/definitions/Governance" }
      },
      "required": ["status","memory_id","tag","importance","domain","summary","governance"]
    },
    {
      "title": "Updated",
      "type": "object",
      "properties": {
        "status": { "const": "updated" },
        "memory_id": { "type": "string" },
        "tag": { "type": "string" },
        "originally_created": { "type": "string", "format": "date-time" },
        "updated": { "type": "string", "format": "date-time" },
        "changes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "section": { "type": "string" },
              "change": { "type": "string" }
            },
            "required": ["section","change"]
          }
        },
        "governance": { "$ref": "#/definitions/Governance" }
      },
      "required": ["status","memory_id","tag","originally_created","updated","changes","governance"]
    },
    {
      "title": "MultipleMatches",
      "type": "object",
      "properties": {
        "status": { "const": "multiple_matches" },
        "candidates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "memory_id": { "type": "string" },
              "created": { "type": "string" },
              "summary": { "type": "string" }
            },
            "required": ["memory_id","created","summary"]
          }
        }
      },
      "required": ["status","candidates"]
    },
    {
      "title": "RelatedFound",
      "type": "object",
      "properties": {
        "status": { "const": "related_found" },
        "memory_id": { "type": "string" },
        "tag": { "type": "string" },
        "similarity": { "type": "number", "minimum": 0, "maximum": 1 },
        "created": { "type": "string" },
        "summary": { "type": "string" }
      },
      "required": ["status","memory_id","tag","similarity","created","summary"]
    },
    {
      "title": "NotFound",
      "type": "object",
      "properties": {
        "status": { "const": "not_found" },
        "identifier": { "type": "string" },
        "id_type": { "enum": ["uuid","tag"] }
      },
      "required": ["status","identifier","id_type"]
    },
    {
      "title": "InsufficientContext",
      "type": "object",
      "properties": {
        "status": { "const": "insufficient_context" },
        "needed": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["status","needed"]
    },
    {
      "title": "OperationFailed",
      "type": "object",
      "properties": {
        "status": { "const": "error" },
        "message": { "type": "string" },
        "mode": { "enum": ["new","update","auto"] }
      },
      "required": ["status","message","mode"]
    }
    ]
}

---

## Memory Integration with Recall

This memorize command works in conjunction with the `/recall` command (documented in `/.cortexdx/commands/recall.md`) to provide comprehensive memory management:

- **Memorize**: Stores new governance context and decisions with automatic recall integration
- **Recall**: Retrieves and analyzes stored memories with hybrid search and governance metadata

For detailed memory recall capabilities, use the `/recall` command which provides deterministic output, provenance tracking, and advanced search features.
