import type { Finding } from "@brainwav/cortexdx-core";

export function buildFilePlan(findings: Finding[]): string[] {
  const patches: string[] = [];
  if (findings.some((finding) => finding.id.startsWith("sse."))) {
    patches.push(
      [
        "@@ server/sse.ts @@",
        "-  // TODO",
        "+  res.setHeader('Content-Type','text/event-stream');",
        "+  res.setHeader('Cache-Control','no-cache');",
        "+  res.flushHeaders();",
        "+  const keepAlive=setInterval(()=>res.write(':\\n\\n'),15000);",
        "+  req.on('close',()=>clearInterval(keepAlive));"
      ].join("\n")
    );
  }
  return patches;
}
