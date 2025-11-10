import type { DiagnosticPlugin, Finding } from "../types.js";

export const JsonRpcBatchPlugin: DiagnosticPlugin = {
  id: "jsonrpc-batch",
  title: "JSON-RPC Batch & Notifications",
  order: 115,
  async run(ctx) {
    const findings: Finding[] = [];
    const body = [
      { jsonrpc: "2.0", id: "a", method: "rpc.ping" },
      { jsonrpc: "2.0", method: "rpc.notify", params: { x: 1 } },
      { jsonrpc: "2.0", id: 7, method: "tools/list" }
    ];

    try {
      await ctx.jsonrpc<unknown>("rpc.ping");
    } catch (error) {
      ctx.logger("[brAInwav] jsonrpc-batch preflight ping failed", error);
    }
    const sessionHeaders = ctx.transport?.headers?.() ?? ctx.headers ?? {};

    let response: unknown;
    try {
      const res = await fetch(ctx.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...sessionHeaders,
        },
        body: JSON.stringify(body)
      });
      response = await res.json();
    } catch (error) {
      return [
        {
          id: "batch.req.error",
          area: "protocol",
          severity: "major",
          title: "Batch request failed",
          description: String(error),
          evidence: [{ type: "url", ref: ctx.endpoint }]
        }
      ];
    }

    if (!Array.isArray(response)) {
      return [
        {
          id: "batch.not_array",
          area: "protocol",
          severity: "major",
          title: "Batch response is not an array",
          description: `Type: ${typeof response}`,
          evidence: [{ type: "log", ref: "JSON-RPC batch" }]
        }
      ];
    }

    const records = response.filter(isRecord);
    const ids = new Set(extractIds(records));
    const notificationEchoed = records.some((item) => !("id" in item));
    if (!ids.has("a") || !ids.has(7) || notificationEchoed) {
      findings.push({
        id: "batch.ids.mismatch",
        area: "protocol",
        severity: "major",
        title: "Batch/notification id mismatch",
        description: "Expected responses for ids 'a' and 7, none for notification.",
        evidence: [{ type: "log", ref: JSON.stringify(response).slice(0, 500) }],
        confidence: 0.8
      });
    }

    const errNoData = records.find((item) => hasErrorWithoutData(item));
    if (errNoData) {
      findings.push({
        id: "batch.error.no_data",
        area: "protocol",
        severity: "minor",
        title: "JSON-RPC error without error.data",
        description: "Consider returning error.data for debuggability.",
        evidence: [{ type: "log", ref: JSON.stringify(errNoData).slice(0, 300) }]
      });
    }

    if (findings.length === 0) {
      findings.push({
        id: "batch.ok",
        area: "protocol",
        severity: "info",
        title: "Batch + notifications handled",
        description: "Server returns array; notifications produce no response.",
        evidence: [{ type: "url", ref: ctx.endpoint }]
      });
    }
    return findings;
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractIds(records: Array<Record<string, unknown>>): Array<string | number> {
  return records
    .map((item) => {
      const id = item.id;
      if (typeof id === "string" || typeof id === "number") return id;
      return undefined;
    })
    .filter((id): id is string | number => id !== undefined);
}

function hasErrorWithoutData(record: Record<string, unknown>): boolean {
  if (!("error" in record)) return false;
  const error = record.error;
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { data?: unknown };
  return !("data" in candidate);
}
