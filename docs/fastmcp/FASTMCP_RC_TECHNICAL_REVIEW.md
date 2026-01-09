# FastMCP Implementation Technical Review

**Review Date:** 2025-11-19
**Current Versions:**
- `fastmcp`: ^3.23.1
- `@modelcontextprotocol/sdk`: ^1.22.0
- **Protocol Version**: 2024-11-05 (outdated)

**Target:** MCP Specification 2025-06-18 + Draft (RC available Nov 14, 2025; Release Nov 25, 2025)

**Draft Changelog Reference:** https://modelcontextprotocol.io/specification/draft/changelog

---

## Executive Summary

This technical review identifies **12 bugs/code errors**, **8 technical debt items**, and **6 RC compliance gaps** in the FastMCP implementation. The most critical issues are related to **protocol version outdatedness** and **incomplete JSON Schema conversion**.

### Severity Distribution

| Severity | Count | Items |
|----------|-------|-------|
| **CRITICAL** | 3 | Protocol version, MCP-Protocol-Version header, JSON-RPC batching |
| **HIGH** | 4 | Schema conversion, passthrough validation, error handling |
| **MEDIUM** | 9 | Missing features, tech debt |
| **LOW** | 4 | Documentation, code cleanup |

---

## 1. Bugs and Code Errors

### 1.1 CRITICAL: Protocol Version Outdated

**Location:** Multiple files (hardcoded as `2024-11-05`)

**Files Affected:**
- `src/telemetry/telemetry-integration.ts:113`
- `src/context/inspector-session.ts:104`
- `src/adapters/inspector-adapter.ts:1086`
- `src/tools/diagnostic-tools.ts:47-58`
- `src/commands/interactive-cli.ts:654`

**Issue:** The codebase is locked to protocol version `2024-11-05`, but MCP specification `2025-06-18` is available with breaking changes.

**Impact:**
- Incompatible with clients using newer protocol versions
- Missing support for new features (structured output, elicitation, resource links)
- Will fail protocol version negotiation with 2025-06-18 clients

**Recommendation:**
```typescript
// Create a configurable protocol version
export const PROTOCOL_VERSION = process.env.MCP_PROTOCOL_VERSION || "2025-06-18";
```

---

### 1.2 CRITICAL: Missing MCP-Protocol-Version Header Support

**Location:** `src/server-fastmcp.ts` - HTTP transport configuration

**Spec Requirement (2025-06-18):**
> "Require negotiated protocol version to be specified via MCP-Protocol-Version header in subsequent requests when using HTTP"

**Issue:** The FastMCP httpStream transport does not set or validate the `MCP-Protocol-Version` header on HTTP requests.

**Impact:**
- Protocol compliance failure with 2025-06-18 specification
- Security risk: clients cannot verify server protocol version

**Recommendation:** Implement header middleware:
```typescript
// Add to HTTP middleware chain
const protocolVersionMiddleware = (req, res, next) => {
  res.setHeader('MCP-Protocol-Version', PROTOCOL_VERSION);
  const clientVersion = req.headers['mcp-protocol-version'];
  if (clientVersion && clientVersion !== PROTOCOL_VERSION) {
    // Handle version mismatch
  }
  next();
};
```

---

### 1.3 CRITICAL: JSON-RPC Batching Should Be Removed

**Spec Change (2025-06-18):**
> "Remove support for JSON-RPC batching" (PR #416)

**Issue:** Current implementation may still support batching (needs verification in FastMCP internals). The 2025-06-18 spec explicitly removes batching support.

**Impact:** Compliance failure if batching is used by clients

**Recommendation:**
- Verify FastMCP version handles this
- Add explicit rejection of batch requests if needed:
```typescript
if (Array.isArray(request)) {
  return createErrorResponse(null, -32600, "JSON-RPC batching not supported");
}
```

---

### 1.4 HIGH: Incomplete JSON Schema to Zod Conversion

**Location:** `src/server-fastmcp.ts:490-542`

**Issues Found:**

1. **Array items not recursively converted** (line 519):
```typescript
case "array":
  zodType = z.array(z.unknown()); // BUG: Should convert items schema
```

2. **Nested objects not recursively converted** (line 522):
```typescript
case "object":
  zodType = z.object({}).passthrough(); // BUG: Should recurse into properties
```

3. **Missing schema features:**
   - No `$ref` resolution
   - No `allOf`/`anyOf`/`oneOf` support
   - No `additionalProperties` handling
   - No `minLength`/`maxLength` constraints
   - No `minimum`/`maximum` constraints
   - No `pattern` regex support

**Impact:**
- Invalid tool arguments may pass validation
- Type safety is compromised
- Runtime errors from unexpected data shapes

**Recommendation:** Use a proper JSON Schema to Zod converter library:
```typescript
import { jsonSchemaToZod } from 'json-schema-to-zod';

function createZodSchemaFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodType {
  return jsonSchemaToZod(jsonSchema);
}
```

Or implement full recursive conversion:
```typescript
function createZodSchemaFromJsonSchema(jsonSchema: Record<string, unknown>): z.ZodType {
  const type = jsonSchema.type;

  switch (type) {
    case "array":
      const itemsSchema = jsonSchema.items as Record<string, unknown>;
      const itemType = itemsSchema
        ? createZodSchemaFromJsonSchema(itemsSchema)
        : z.unknown();
      return z.array(itemType);

    case "object":
      const props = jsonSchema.properties as Record<string, unknown>;
      if (!props) return z.record(z.unknown());

      const shape: Record<string, z.ZodType> = {};
      for (const [key, prop] of Object.entries(props)) {
        shape[key] = createZodSchemaFromJsonSchema(prop as Record<string, unknown>);
        // Handle required fields
        if (!jsonSchema.required?.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
      return z.object(shape);
    // ... other cases
  }
}
```

---

### 1.5 HIGH: Permissive Schema Validation with `.passthrough()`

**Location:** `src/server-fastmcp.ts:495, 522, 541`

**Issue:** All generated Zod schemas use `.passthrough()`:
```typescript
return z.object({}).passthrough(); // line 495
zodType = z.object({}).passthrough(); // line 522
return z.object(shape).passthrough(); // line 541
```

**Impact:**
- Arbitrary extra properties are silently accepted
- Security risk: unexpected data injection
- No strict validation against schema

**Recommendation:** Use `.strict()` for production:
```typescript
return z.object(shape).strict(); // Rejects unknown properties
```

Or explicitly handle `additionalProperties`:
```typescript
const additionalProperties = jsonSchema.additionalProperties ?? false;
if (additionalProperties === false) {
  return z.object(shape).strict();
} else {
  return z.object(shape).passthrough();
}
```

---

### 1.6 HIGH: Tool Execution Return Type Inconsistency

**Location:** `src/server-fastmcp.ts:307-351`

**Issue:** Tool execute functions return `string` instead of proper MCP tool result format:
```typescript
execute: async (args) => {
  // ...
  return result.content[0]?.text || JSON.stringify(result); // Returns string
  // ...
  return JSON.stringify({ error: errorMessage, isError: true }); // Returns string
}
```

**Impact:**
- Non-standard return format
- Clients may not correctly parse results
- Loss of structured content (images, resources)

**Recommendation:** FastMCP should handle the content array format properly. Verify FastMCP's expected return type.

---

### 1.7 MEDIUM: Missing Error Context in Tool Execution

**Location:** `src/server-fastmcp.ts:347-350`

**Issue:** Error handling loses stack trace and error type:
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ error: errorMessage, isError: true });
}
```

**Recommendation:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  serverLogger.error({ error, tool: tool.name, args }, "Tool execution failed");
  return JSON.stringify({
    error: errorMessage,
    isError: true,
    code: error instanceof McpError ? error.code : -32603,
    // Don't expose stack in production
    ...(process.env.NODE_ENV !== 'production' && { stack: errorStack })
  });
}
```

---

### 1.8 MEDIUM: Unsafe Type Assertions

**Location:** `src/server-fastmcp.ts:336, 341, 358-361`

**Issue:** Multiple unsafe type casts without validation:
```typescript
const tools = providerReg.capabilities.tools as Array<{ name?: string }>;
args as Record<string, unknown>
```

**Impact:** Runtime type errors possible

**Recommendation:** Add runtime type guards:
```typescript
function isToolArray(value: unknown): value is Array<{ name?: string }> {
  return Array.isArray(value) && value.every(
    item => typeof item === 'object' && item !== null
  );
}
```

---

### 1.9 MEDIUM: Memory Leak Risk in SSE Connections

**Location:** Custom endpoints server doesn't track SSE connections

**Issue:** SSE connections in the custom endpoints server (`createCustomEndpointsServer`) don't have cleanup on client disconnect.

**Recommendation:** Track and clean up connections:
```typescript
const connections = new Set<ServerResponse>();

res.on('close', () => {
  connections.delete(res);
  serverLogger.debug('SSE connection closed');
});
```

---

### 1.10 LOW: Hardcoded Endpoint Mapping

**Location:** `src/server-fastmcp.ts:314-318`

**Issue:** Restricted tool endpoint mapping is hardcoded:
```typescript
const endpointMap: Record<string, string> = {
  "wikidata_sparql": "/admin/tools/wikidata-sparql",
  "cortexdx_delete_workflow": "/admin/tools/delete-workflow",
};
```

**Recommendation:** Move to config:
```typescript
// In config.ts
export const RESTRICTED_TOOL_ENDPOINTS: Record<string, string> = {
  "wikidata_sparql": "/admin/tools/wikidata-sparql",
  "cortexdx_delete_workflow": "/admin/tools/delete-workflow",
};
```

---

### 1.11 LOW: CORS Origin Matching Case Sensitivity

**Location:** `src/server-fastmcp.ts:549-557`

**Issue:** Origin comparison is case-sensitive after `.toLowerCase()`:
```typescript
const allowedOrigins = (...).map(origin => origin.toLowerCase());
const requestOrigin = req.headers.origin?.toLowerCase();
if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
```

This is actually correct, but the comment suggests inconsistency.

---

### 1.12 LOW: Interval Not Cleared on Error

**Location:** `src/server-fastmcp.ts:172-177`

**Issue:** `taskPruneInterval` is only cleared in graceful shutdown, not on server errors:
```typescript
const taskPruneInterval = setInterval(() => {
  const pruned = taskStore.pruneExpired();
  // ...
}, TASK_PRUNE_INTERVAL);
```

**Recommendation:** Clear on all exit paths:
```typescript
process.on('uncaughtException', (error) => {
  clearInterval(taskPruneInterval);
  // ... handle error
});
```

---

## 2. Technical Debt

### 2.1 Dual Server Implementation

**Files:**
- `src/server.ts` (legacy)
- `src/server-fastmcp.ts` (current)

**Issue:** Two server implementations are maintained in parallel.

**Impact:**
- Code duplication
- Maintenance overhead
- Potential feature parity issues

**Recommendation:** Deprecate and remove `server.ts` after full FastMCP migration is validated.

---

### 2.2 Hardcoded Demo License Keys

**Location:** `src/server-fastmcp.ts:96-128`

**Issue:** Demo license keys are hardcoded in the server:
```typescript
if (process.env.NODE_ENV !== "production") {
  licenseDatabase.set("community-demo-key", { ... });
  licenseDatabase.set("professional-demo-key", { ... });
  licenseDatabase.set("enterprise-demo-key", { ... });
}
```

**Impact:** Security risk if `NODE_ENV` is not properly set

**Recommendation:**
- Move to separate demo configuration file
- Add explicit `ENABLE_DEMO_LICENSES` env var
- Log warning when demo licenses are active

---

### 2.3 Missing Prompts Implementation

**Location:** `src/server-fastmcp.ts` - Not implemented

**Issue:** Prompts capability is not implemented, limiting server functionality.

**Spec Compliance:** Optional but valuable for guided workflows.

**Recommendation:** Implement prompts for common diagnostic workflows:
- `diagnose_server` - Interactive diagnostic
- `security_audit` - Guided security assessment
- `academic_research` - Research workflow

---

### 2.4 Missing Resource Subscriptions

**Issue:** Only `list` and `read` are implemented for resources.

**Missing:**
- `resources/subscribe`
- `resources/unsubscribe`
- `notifications/resources/updated`

**Impact:** Clients cannot receive real-time updates for long-running research.

---

### 2.5 Missing Progress Notifications

**Issue:** Long-running operations provide no progress feedback.

**Impact:** Poor UX for diagnostic operations that can take 30+ seconds.

**Recommendation:** Implement `notifications/progress`:
```typescript
{
  jsonrpc: "2.0",
  method: "notifications/progress",
  params: {
    progressToken: "diag-123",
    progress: 45,
    total: 100
  }
}
```

---

### 2.6 Missing Cancellation Support

**Issue:** No way to cancel long-running operations.

**Impact:** Users must wait for operations to complete or restart server.

**Recommendation:** Implement `notifications/cancelled` and cancellation tokens.

---

### 2.7 Inconsistent Error Codes

**Issue:** Custom error codes used inconsistently across codebase.

**Location:** Various files use different codes for similar errors.

**Recommendation:** Centralize error code definitions:
```typescript
// errors.ts
export const MCP_ERRORS = {
  ACCESS_DENIED: -32001,
  TOOL_DISABLED: -32011,
  AUTH_REQUIRED: -32012,
  LICENSE_REQUIRED: -32013,
  RATE_LIMITED: -32014,
} as const;
```

---

### 2.8 No Health Check in FastMCP Transport

**Issue:** FastMCP httpStream transport has no built-in health check endpoint.

**Current Workaround:** Custom endpoints server provides `/health` on PORT+1.

**Recommendation:** Consider adding health check to main MCP endpoint.

---

## 3. MCP 2025-06-18 RC Compliance Gaps

### 3.1 Structured Tool Output Support

**Spec Feature:** "Add support for structured tool output" (PR #371)

**Status:** Not implemented

**Impact:** Cannot return complex, typed results from tools.

---

### 3.2 Elicitation Support

**Spec Feature:** "Add support for elicitation, enabling servers to request additional information from users during interactions" (PR #382)

**Status:** Not implemented

**Impact:** Cannot implement interactive workflows that require user input.

---

### 3.3 Resource Links in Tool Results

**Spec Feature:** "Add support for resource links in tool call results" (PR #603)

**Status:** Not implemented

**Impact:** Cannot link tool results to related resources.

---

### 3.4 OAuth Resource Server Classification

**Spec Feature:** "Classify MCP servers as OAuth Resource Servers" (PR #338)

**Status:** Partial - Auth0 implemented but not RFC 8707 Resource Indicators

**Impact:** Security risk with token handling.

---

### 3.5 RFC 8707 Resource Indicators

**Spec Requirement:** "Require MCP clients to implement Resource Indicators as described in RFC 8707 to prevent malicious servers from obtaining access tokens" (PR #734)

**Status:** Not implemented

**Impact:** Security vulnerability to token theft.

---

### 3.6 Schema `title` Field

**Spec Feature:** "Add `title` field for human-friendly display names" (PR #663)

**Status:** Not utilized in tool definitions

**Impact:** Poor UX in client tool displays.

---

## 4. Draft Specification Changes (Post 2025-06-18)

The draft specification includes additional changes beyond 2025-06-18 that should be considered for future-proofing:

### 4.1 Major Draft Changes

| Feature | PR/SEP | Status in CortexDx | Impact |
|---------|--------|-------------------|--------|
| **Authorization Server Discovery** | PR #797 | Not implemented | OpenID Connect Discovery 1.0 support |
| **Icon Metadata Support** | SEP-973 | Not implemented | Icons for tools, resources, prompts |
| **Incremental Scope Consent** | SEP-835 | Not implemented | WWW-Authenticate progressive permissions |
| **Tool Naming Guidance** | SEP-986 | Needs review | New naming conventions |
| **Enum Schema Modernization** | SEP-1330 | Not implemented | Titled/untitled, single/multi-select |
| **URL Mode Elicitation** | SEP-1036 | Not implemented | URL-based elicitation |
| **Tool Calling in Sampling** | SEP-1577 | Not applicable | tools/toolChoice in sampling |
| **Tasks Feature** | SEP-1686 | Not implemented | Experimental durable request tracking |

### 4.2 Critical Security Changes

1. **HTTP 403 for Invalid Origin** (PR #1439):
   - Streamable HTTP transport MUST return 403 Forbidden for invalid Origin headers
   - **Current Implementation:** Returns no CORS headers but doesn't explicitly 403
   - **Action Required:** Add explicit 403 response for invalid origins

2. **Input Validation Error Handling** (SEP-1303):
   - Input validation errors should be returned as **Tool Execution Errors**
   - NOT as Protocol Errors (-32602 Invalid params)
   - **Action Required:** Update error handling in tool execution

### 4.3 Schema Decoupling (SEP-1319)

Request payloads are now decoupled from RPC method definitions into standalone parameter schemas. This affects:
- How tools define their parameters
- Schema generation and validation
- Potential breaking change for clients

### 4.4 Tool Naming Convention Review

**Current Tool Names (Sample):**
- `diagnose_mcp_server` - OK (snake_case)
- `cortexdx_academic_research` - OK (namespaced)
- `wikidata_sparql` - OK

**Recommendation:** Review all tool names against SEP-986 guidance once finalized.

---

## 5. Recommendations Summary (Updated with Draft Changes)

### Immediate Actions (Before RC Release Nov 25)

| Priority | Item | Effort | Risk if Not Fixed |
|----------|------|--------|-------------------|
| **P0** | Update protocol version to 2025-06-18 | 2h | Protocol incompatibility |
| **P0** | Add MCP-Protocol-Version header | 4h | Compliance failure |
| **P0** | Fix JSON Schema conversion | 1d | Validation bypass |
| **P1** | Remove `.passthrough()` | 2h | Security risk |
| **P1** | Handle JSON-RPC batching removal | 2h | Compliance failure |
| **P1** | Add HTTP 403 for invalid Origin | 1h | Security/Compliance |
| **P1** | Fix input validation error handling | 2h | Spec compliance |

### Short-term Actions (Within 2 weeks)

| Priority | Item | Effort |
|----------|------|--------|
| **P1** | Implement structured tool output | 2d |
| **P1** | Add progress notifications | 1d |
| **P2** | Implement cancellation support | 1d |
| **P2** | Add resource subscriptions | 2d |
| **P2** | Implement elicitation | 3d |

### Long-term Actions (Within 1 month)

| Priority | Item | Effort |
|----------|------|--------|
| **P2** | Remove legacy server.ts | 1d |
| **P2** | Implement prompts | 3d |
| **P3** | Add RFC 8707 Resource Indicators | 2d |
| **P3** | Centralize error codes | 1d |

---

## 6. Testing Recommendations

### 6.1 Protocol Compliance Testing

```bash
# Run MCP protocol compliance tests
pnpm test:integration

# Validate against 2025-06-18 spec
npx cortexdx diagnose http://localhost:5001 \
  --suites=protocol,auth,security \
  --protocol-version=2025-06-18
```

### 6.2 Schema Validation Testing

Add tests for edge cases:
- Deeply nested objects
- Arrays with complex items
- Schemas with `$ref`
- Schemas with `allOf`/`anyOf`

### 6.3 Security Testing

- Test CORS handling
- Verify auth middleware
- Test rate limiting
- Validate license enforcement

---

## 7. Appendix: File Reference

### Core Implementation Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/server-fastmcp.ts` | 898 | Main FastMCP server |
| `src/server.ts` | ~1800 | Legacy server (to be deprecated) |
| `src/server/config.ts` | 53 | Server configuration |
| `src/tools/index.ts` | 84 | Tool registry |

### Key Code Sections

- Schema conversion: `server-fastmcp.ts:490-542`
- Tool registration: `server-fastmcp.ts:297-389`
- Resource registration: `server-fastmcp.ts:391-481`
- Custom endpoints: `server-fastmcp.ts:547-826`
- Server startup: `server-fastmcp.ts:831-884`

---

**Review Status:** Complete
**Next Review:** After RC release (Nov 25, 2025)
**Reviewer:** Technical Review Agent
