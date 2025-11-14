---
description: Restore conversation context from persistent memory (deterministic, provenance-rich, privacy-aware)
argument-hint: [memory-id | tag | natural language]
---

# /recall

> You are the **/recall** command. Retrieve and render prior memory with **deterministic output** and **schema‑validated Retrieval JSON**. Do **not** include chain‑of‑thought; end with a short **VerificationSummary** (2–5 bullets). Emit **exactly one** Markdown artifact per run. Derived from the original `/recall` spec. :contentReference[oaicite:6]{index=6}

## System Guardrails

- **Safety & Privacy:** Minimize surfaced PII; apply **redaction‑on‑restore** when classification ≥ `pii`. If the redaction gate flags unsafe content, return a structured **Retrieval Error** frame. :contentReference[oaicite:7]{index=7}
- **Determinism:** Stable headings, field order, and thresholds; idempotent reads (no state changes).
- **Time & IDs:** All dates **ISO‑8601 UTC**; UUIDs are 36 chars with hyphens.
- **Output contract:** One Markdown block with:
  1) Heading (`Memory Recalled` | `Multiple Memories Found` | `Memory Not Found` | `Memory Retrieval Failed`)
  2) **Retrieval Information (JSON)** — includes provenance & governance
  3) Restored memory body (8 sections)
  4) **VerificationSummary** (2–5 bullets)

## Identifier Processing

- **UUID** (`[0-9a-f-]{36}`) → `get_memory_by_id` (direct).  
- **Tag** (`lowercase_underscores`) → `search` (semantic).  
- **Natural language** → `search` (semantic).

## Retrieval Pipeline (documented, auditable)

1) **Normalize query** `Q0` from `$ARGUMENTS`.  
2) **Multi‑query expansion**: generate 3–5 diverse rewrites `{Q1..Qn}`; union top‑k results across rewrites. (Document under `provenance.rewrites[]`.) :contentReference[oaicite:8]{index=8}  
3) **Hybrid search** (dense + lexical) with explicit knobs: `k`, `alpha` (vector weight), `min_similarity` (dense), `min_bm25` (sparse). :contentReference[oaicite:9]{index=9}  
4) **Diversify** with **MMR** over the candidate set (balance λ=0.5 unless overridden). :contentReference[oaicite:10]{index=10}  
5) **Re‑rank** top N (e.g., 50) using a **cross‑encoder**; include `reranker_score` and model id in provenance. :contentReference[oaicite:11]{index=11}  
6) **Thresholds & gating** (applied after re‑rank):
   - `similarity ≥ 0.90` → **Direct Recall** (single best).  
   - `0.75–0.90` → **Multiple Memories Found** (present 3–7, sorted; ask once).  
   - `< 0.75` or none → **Memory Not Found** with suggestions.  
   (You may tune thresholds per corpus; record actual values in `provenance.search_params`.) :contentReference[oaicite:12]{index=12}
7) **Staleness notice:** if `original_date` > 180 days old, display the note (unchanged from your spec). :contentReference[oaicite:13]{index=13}
8) **Governance on read:** annotate `governance` with `data_classification`, `redactions_applied[]`, `purpose_of_access`, `lawful_basis` (if PII), `access_log_id`. :contentReference[oaicite:14]{index=14}

## Output Frames (verbatim shapes)

### Success — Direct Recall

```

## Memory Recalled

**Retrieval Information (JSON)**

```json
{
  "status": "recalled",
  "context_restored_from": "<uuid|tag|natural_language>",
  "memory_id": "<uuid>",
  "tag": "<tag>",
  "original_date": "<ISO-8601>",
  "last_updated": "<ISO-8601>",
  "rank": 1,
  "similarity": 0.xx,
  "reranker_score": 0.xx,
  "stale": false,
  "provenance": {
    "query": "<Q0>",
    "rewrites": ["<Q1>", "<Q2>", "..."],
    "search_params": {
      "k": 50,
      "alpha": 0.50,
      "min_similarity": 0.75,
      "min_bm25": 0.0,
      "mmr_lambda": 0.50,
      "use_reranker": true,
      "reranker_model": "<id>"
    },
    "pipeline": ["multi_query", "hybrid", "mmr", "rerank"],
    "index_snapshot": "<commit-or-ts>"
  },
  "governance": {
    "data_classification": "internal",
    "redactions_applied": [],
    "purpose_of_access": "engineering_evidence",
    "lawful_basis": "legitimate_interest",
    "access_log_id": "<uuid>"
  },
  "summary": "<1–2 sentence gist>"
}
```

**Core Understanding**
...

**Conversation Evolution**

- 2025-11-11: ...

**Key Decisions**

- <decision>: <rationale>

**Specifications/Artifacts Created**
...

**Important Points**

- ...

**User Context**

- Why: ...
- Work: ...
- Use: ...

**Related Systems**

- <system>: <relationship>

**Context & Constraints**

- Technical: ...
- Operational: ...

**VerificationSummary**

- Retrieved via hybrid → MMR → cross‑encoder re‑rank
- Provenance + scores attached
- Redactions applied: <list>
- Thresholds: sim=..., k=..., alpha=...

```

### Multiple Matches (Ask once)
```

## Multiple Memories Found

Query: "<Q0>"

1. **Tag:** <tag_1> | Similarity: 0.xx | Updated: <date>
   **Memory ID:** <uuid_1>
   Summary: <one line>

2. **Tag:** <tag_2> | Similarity: 0.xx | Updated: <date>
   **Memory ID:** <uuid_2>
   Summary: <one line>

Reply with a number or `/recall <memory-id>`.

```

### Not Found
```

## Memory Not Found

Identifier: **<identifier>**

Suggestions:

- Try different keywords / synonyms
- Use `/recall <tag>` for a specific tag
- Browse recent: show last 10?

Issues:

- Tags are lowercase_underscores
- UUIDs must be full (36 chars)

Options:

1. Show recent memories
2. Search different terms
3. List all tags

```

### Retrieval Error (incl. redaction gate)
```

## Memory Retrieval Failed

**Error:** <message or "redaction-on-restore gate failed">

Troubleshooting:

1. Check MCP status: `/mcp`
2. Relax filters or adjust thresholds
3. Verify permissions / policy settings

````

> Notes: Keep verbosity low; one block only. This file is a local slash‑prompt—front‑matter and `$ARGUMENTS` are supported. :contentReference[oaicite:15]{index=15}

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
  "CITATIONS": "required",
  "VALIDATION": "schema"
}
````

**Schema**

```json
{
  "type": "object",
  "definitions": {
    "Provenance": {
      "type": "object",
      "properties": {
        "query": { "type": "string" },
        "rewrites": { "type": "array", "items": { "type": "string" } },
        "search_params": {
          "type": "object",
          "properties": {
            "k": { "type": "integer", "minimum": 1 },
            "alpha": { "type": "number", "minimum": 0, "maximum": 1 },
            "min_similarity": { "type": "number", "minimum": 0, "maximum": 1 },
            "min_bm25": { "type": "number", "minimum": 0 },
            "mmr_lambda": { "type": "number", "minimum": 0, "maximum": 1 },
            "use_reranker": { "type": "boolean" },
            "reranker_model": { "type": "string" }
          },
          "required": ["k","alpha","min_similarity","use_reranker"]
        },
        "pipeline": { "type": "array", "items": { "type": "string" } },
        "index_snapshot": { "type": "string" }
      },
      "required": ["query","search_params","pipeline"]
    },
    "Governance": {
      "type": "object",
      "properties": {
        "data_classification": { "type": "string", "enum": ["public","internal","confidential","pii","special_category_pii"] },
        "redactions_applied": { "type": "array", "items": { "type": "string" } },
        "purpose_of_access": { "type": "string" },
        "lawful_basis": { "type": "string", "enum": ["contract","consent","legal_obligation","legitimate_interest","vital_interest","public_task"] },
        "access_log_id": { "type": "string", "minLength": 36, "maxLength": 36 }
      },
      "required": ["data_classification","redactions_applied","purpose_of_access"]
    },
    "Candidate": {
      "type": "object",
      "properties": {
        "memory_id": { "type": "string" },
        "tag": { "type": "string" },
        "created": { "type": "string", "format": "date-time" },
        "updated": { "type": "string", "format": "date-time" },
        "similarity": { "type": "number", "minimum": 0, "maximum": 1 },
        "reranker_score": { "type": "number" },
        "summary": { "type": "string" }
      },
      "required": ["memory_id","tag","created","similarity","summary"]
    }
  },
  "oneOf": [
    {
      "title": "Recalled",
      "type": "object",
      "properties": {
        "status": { "const": "recalled" },
        "context_restored_from": { "type": "string" },
        "memory_id": { "type": "string" },
        "tag": { "type": "string" },
        "original_date": { "type": "string", "format": "date-time" },
        "last_updated": { "type": "string", "format": "date-time" },
        "rank": { "type": "integer", "minimum": 1 },
        "similarity": { "type": "number", "minimum": 0, "maximum": 1 },
        "reranker_score": { "type": "number" },
        "stale": { "type": "boolean" },
        "provenance": { "$ref": "#/definitions/Provenance" },
        "governance": { "$ref": "#/definitions/Governance" },
        "summary": { "type": "string" }
      },
      "required": ["status","context_restored_from","memory_id","tag","original_date","rank","similarity","provenance","governance","summary"]
    },
    {
      "title": "MultipleMatches",
      "type": "object",
      "properties": {
        "status": { "const": "multiple_matches" },
        "query": { "type": "string" },
        "candidates": { "type": "array", "items": { "$ref": "#/definitions/Candidate" }, "minItems": 2 }
      },
      "required": ["status","query","candidates"]
    },
    {
      "title": "NotFound",
      "type": "object",
      "properties": {
        "status": { "const": "not_found" },
        "identifier": { "type": "string" }
      },
      "required": ["status","identifier"]
    },
    {
      "title": "RetrievalError",
      "type": "object",
      "properties": {
        "status": { "const": "error" },
        "message": { "type": "string" }
      },
      "required": ["status","message"]
    }
  ]
}
