import type { DiagnosticPlugin, Finding } from "../types.js";

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

async function readHead(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers: { accept: "text/event-stream", ...(headers ?? {}) } });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("text/event-stream")) {
    return { ok: false as const, text: "", status: res.status, ct: contentType };
  }
  const reader = res.body?.getReader();
  if (!reader) return { ok: false as const, text: "", status: res.status, ct: contentType };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 2048) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const text = new TextDecoder().decode(concatChunks(chunks));
  return { ok: true as const, text, status: res.status, ct: contentType };
}

export const SseReconnectPlugin: DiagnosticPlugin = {
  id: "sse-reconnect",
  title: "SSE Reconnect (retry & Last-Event-ID)",
  order: 205,
  async run(ctx) {
    const findings: Finding[] = [];
    const base = `${ctx.endpoint.replace(/\/$/, "")}`;
    const url = `${base}/events`;
    const sessionHeaders = ctx.transport?.headers?.() ?? ctx.headers ?? {};

    const first = await readHead(url, sessionHeaders);
    if (!first.ok) {
      return [
        {
          id: "sse.reconnect.unreachable",
          area: "streaming",
          severity: "minor",
          title: "Reconnect check skipped (SSE not reachable)",
          description: `status=${first.status} ct=${first.ct}`,
          evidence: [{ type: "url", ref: url }]
        }
      ];
    }

    if (!/(\n|^)retry:\s*\d+/m.test(first.text)) {
      findings.push({
        id: "sse.retry.missing",
        area: "streaming",
        severity: "minor",
        title: "No retry: directive seen in stream head",
        description: "Consider emitting 'retry: <ms>' to hint reconnection backoff.",
        evidence: [{ type: "log", ref: first.text.slice(0, 200) }]
      });
    }

    if (!/(\n|^)id:\s*\S+/m.test(first.text)) {
      findings.push({
        id: "sse.id.missing",
        area: "streaming",
        severity: "minor",
        title: "No id: field observed",
        description: "Providing event ids enables resumable streams via Last-Event-ID.",
        evidence: [{ type: "log", ref: first.text.slice(0, 200) }]
      });
    }

    const again = await readHead(url, { ...sessionHeaders, "Last-Event-ID": "1" });
    if (!again.ok) {
      findings.push({
        id: "sse.last_event_id.unhandled",
        area: "streaming",
        severity: "minor",
        title: "Server did not accept Last-Event-ID",
        description: `status=${again.status} ct=${again.ct}`,
        evidence: [{ type: "url", ref: url }]
      });
    }

    if (findings.length === 0) {
      findings.push({
        id: "sse.reconnect.ok",
        area: "streaming",
        severity: "info",
        title: "Reconnect metadata present",
        description: "retry: and id: hints observed; Last-Event-ID path responded.",
        evidence: [{ type: "url", ref: url }]
      });
    }
    return findings;
  }
};
