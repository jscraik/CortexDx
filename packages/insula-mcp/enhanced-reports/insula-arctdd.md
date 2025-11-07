# ArcTDD Implementation Plan (Insula MCP)

**Endpoint:** <https://cortex-mcp.brainwav.io/mcp>
**Inspected:** 2025-11-06T21:14:12.421Z
**Duration:** 9368ms
**North-Star:** Fix blockers first; majors second; address minors for production readiness.

## 🚨 Critical Issues (Blockers)

✅ No blocking issues found!

## ⚠️ Major Issues

### MAJOR: Batch request failed

**Problem:** SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp>
**Area:** protocol

**Solution Steps:**

1. **Fix routing issue:** Ensure `/mcp` endpoint returns JSON, not HTML
2. **Check server configuration:** Verify MCP server is properly mounted at `/mcp` path
3. **Test with:** `curl -X POST https://your-server.com/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'`
4. **Expected:** JSON response, not HTML error page

### MAJOR: SSE endpoint not streaming

**Problem:** Probe failed: HTTP 502
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp/events>
**Area:** streaming

**Solution Steps:**

1. **Implement SSE endpoint:** Add `/events` route for Server-Sent Events
2. **Set proper headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`
3. **Add keepalive:** Send periodic heartbeat messages every 15-30 seconds
4. **Handle cleanup:** Remove clients on connection close
5. **Test with:** `curl -N https://your-server.com/mcp/events`

### MAJOR: No governance pack loaded (.insula)

**Problem:** Wire brAInwav BMAD+PRP gates (G0–G7) and policy-as-prompt checks.
**Evidence:** file:./.insula/*
**Area:** governance

**Solution Steps:**

1. **Create .insula directory:** Add governance configuration in project root
2. **Add policy files:** Create governance policies for security gates (G0-G7)
3. **Configure BMAD+PRP:** Set up brAInwav governance framework
4. **Optional:** Can be skipped for basic MCP functionality

## 📋 Minor Issues & Improvements

### MINOR: Inspector version check recommended

**Problem:** Ensure MCP Inspector >= v0.14.1 to avoid known RCE class. Add --doctor to see environment checks.
**Evidence:** log:env
**Area:** devtool

**Solution Steps:**

1. **Review devtool implementation:** Check the devtool related code
2. **Consult documentation:** Review MCP specification for devtool requirements
3. **Test thoroughly:** Verify fix resolves the issue: "Inspector version check recommended"
4. **Monitor:** Ensure solution doesn't introduce new problems

### MINOR: Could not enumerate tools via JSON-RPC

**Problem:** Endpoint did not respond to 'tools/list'. Server may use a different method.
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp>
**Area:** discovery

**Solution Steps:**

1. **Implement tools/list endpoint:** Add JSON-RPC method handler for `tools/list`
2. **Return proper format:** `{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}`
3. **Include tool schemas:** Each tool needs `name`, `description`, and `inputSchema`
4. **Test with:** JSON-RPC call to `tools/list` method

### MINOR: No 'rpc.ping' response

**Problem:** Server didn't respond to a simple JSON-RPC ping; method name may differ.
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp>
**Area:** protocol

**Solution Steps:**

1. **Add ping method:** Implement `rpc.ping` JSON-RPC method
2. **Return simple response:** `{"jsonrpc":"2.0","id":1,"result":"pong"}`
3. **Optional but recommended:** Helps with connection testing and health checks

### MINOR: Unable to assess tool permissioning

**Problem:** Discovery returned no tools (or unknown shape).
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp>
**Area:** permissioning

**Solution Steps:**

1. **Implement tools/list endpoint:** Add JSON-RPC method handler for `tools/list`
2. **Return proper format:** `{"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}`
3. **Include tool schemas:** Each tool needs `name`, `description`, and `inputSchema`
4. **Test with:** JSON-RPC call to `tools/list` method

### MINOR: Reconnect check skipped (SSE not reachable)

**Problem:** status=502 ct=text/html; charset=UTF-8
**Evidence:** url:<https://cortex-mcp.brainwav.io/mcp/events>
**Area:** streaming

**Solution Steps:**

1. **Implement SSE endpoint:** Add `/events` route for Server-Sent Events
2. **Set proper headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`
3. **Add keepalive:** Send periodic heartbeat messages every 15-30 seconds
4. **Handle cleanup:** Remove clients on connection close
5. **Test with:** `curl -N https://your-server.com/mcp/events`

... and 1 more minor issues (see full report)

## 🎯 Implementation Priority

1. **Phase 1 (Critical):** Fix all blocker issues immediately
2. **Phase 2 (Important):** Address major issues for stability
3. **Phase 3 (Polish):** Resolve minor issues for production readiness

## 🔧 Quick Wins

• **5 min:** Add basic CORS headers to fix cross-origin requests
• **2 min:** Add simple `rpc.ping` method that returns `pong`
• **10 min:** Fix routing to ensure `/mcp` returns JSON not HTML
• **15 min:** Implement basic `tools/list` endpoint with empty array

## 📚 Resources

- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [brAInwav MCP Best Practices](https://docs.brainwav.io/mcp/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

---
*Generated by Insula MCP Diagnostic System*
