import { createParser } from "eventsource-parser";
import type { SseResult } from "../types.js";

export async function sseProbe(url: string, opts?: { timeoutMs?: number }): Promise<SseResult> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "text/event-stream" },
      signal: controller.signal
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) return { ok: false, reason: "wrong content-type" };

    const reader = res.body?.getReader();
    if (!reader) return { ok: false, reason: "no readable body" };
    const parser = createParser(() => undefined);
    let firstAt: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(new TextDecoder().decode(value));
      if (firstAt === null) firstAt = Date.now();
      if (firstAt !== null && Date.now() - firstAt > 5000) break;
    }
    return { ok: true, firstEventMs: firstAt ? Date.now() - firstAt : undefined };
  } catch (error) {
    return { ok: false, reason: String(error) };
  } finally {
    clearTimeout(timer);
  }
}
