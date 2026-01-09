import { createParser } from "eventsource-parser";
import type { SseProbeOptions, SseResult } from "@brainwav/cortexdx-core";

export async function sseProbe(
  url: string,
  opts?: SseProbeOptions,
): Promise<SseResult> {
  const timeoutMs = opts?.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "text/event-stream",
        ...(opts?.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok)
      return { ok: false, reason: `HTTP ${res.status}`, resolvedUrl: url };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream"))
      return { ok: false, reason: "wrong content-type", resolvedUrl: url };

    const reader = res.body?.getReader();
    if (!reader)
      return { ok: false, reason: "no readable body", resolvedUrl: url };
    const parser = createParser(() => undefined);
    let firstAt: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(new TextDecoder().decode(value));
      if (firstAt === null) firstAt = Date.now();
      if (firstAt !== null && Date.now() - firstAt > 5000) break;
    }
    return {
      ok: true,
      firstEventMs: firstAt ? Date.now() - firstAt : undefined,
      resolvedUrl: url,
    };
  } catch (error) {
    return { ok: false, reason: String(error), resolvedUrl: url };
  } finally {
    clearTimeout(timer);
  }
}
