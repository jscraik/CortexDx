# CortexDx Diagnostic Report (brAInwav)
- Endpoint: https://cortex-mcp.brainwav.io/mcp
- Date: 2025-11-06T21:14:12.421Z
- Duration: 9368ms

## [MINOR] Inspector version check recommended
Ensure MCP Inspector >= v0.14.1 to avoid known RCE class. Add --doctor to see environment checks.
- Evidence: log:env

## [MINOR] Could not enumerate tools via JSON-RPC
Endpoint did not respond to 'tools/list'. Server may use a different method.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [MINOR] No 'rpc.ping' response
Server didn't respond to a simple JSON-RPC ping; method name may differ.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [MAJOR] Batch request failed
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [MINOR] Unable to assess tool permissioning
Discovery returned no tools (or unknown shape).
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [MAJOR] SSE endpoint not streaming
Probe failed: HTTP 502
- Evidence: url:https://cortex-mcp.brainwav.io/mcp/events

## [MINOR] Reconnect check skipped (SSE not reachable)
status=502 ct=text/html; charset=UTF-8
- Evidence: url:https://cortex-mcp.brainwav.io/mcp/events

## [MINOR] CORS preflight failed
OPTIONS did not succeed or missing allow headers.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [MAJOR] No governance pack loaded (.insula)
Wire brAInwav BMAD+PRP gates (G0–G7) and policy-as-prompt checks.
- Evidence: file:./.insula/*

## [INFO] Check: Auth scheme validated (G1)
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Check: Tool mutation guarded
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Check: Structured, redacted logs
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Check: No unconstrained net exfil tools
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Check: Backpressure/heartbeat in streaming
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Check: No exec/fs admin tools without prompts
No immediate red flags from heuristics.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Sample latency
628ms (single POST)
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] No commercial license configured
Running in community edition mode with basic features.
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] Compliance Report: OWASP
Compliance Score: 100/100
Status: PASSED

Recommendations:
- Maintain current security posture
- Evidence: log:report-1762463652387-9ucvo0g

## [INFO] Enterprise Security Dashboard
Overall Security Score: 100/100
Active Threats: 0
Recent Alerts: 0
Compliance Status: compliant

Metrics:
- Total Audit Entries: 2
- Failed Auth Attempts: 0
- Blocked Requests: 0
- Vulnerabilities: 0
- Compliance Score: 100/100
- Evidence: url:https://cortex-mcp.brainwav.io/mcp

## [INFO] License validator initialized
Monitoring academic research licenses. Approved licenses: 6
- Evidence: log:license-validator

## [INFO] Compliance monitoring active
Tracking academic integration usage and license compliance.
- Evidence: log:compliance-monitor

---
_Data policy: read-only; optional redacted HAR if --har._