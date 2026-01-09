import type { DiagnosticPlugin, Finding } from "@brainwav/cortexdx-core";

async function preflight(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "OPTIONS",
    headers: {
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type, authorization",
      Origin: "https://diagnostic.local",
      ...headers,
    },
  });
  return {
    ok: response.ok,
    allowHeaders: response.headers.get("access-control-allow-headers") || "",
    allowMethods: response.headers.get("access-control-allow-methods") || "",
  };
}

export const CorsPlugin: DiagnosticPlugin = {
  id: "cors",
  title: "CORS Preflight Matrix",
  order: 210,
  async run(ctx) {
    const url = ctx.endpoint;
    const result = await preflight(url, {});
    if (result.ok) return [];
    return [
      {
        id: "cors.preflight.fail",
        area: "cors",
        severity: "minor",
        title: "CORS preflight failed",
        description: "OPTIONS did not succeed or missing allow headers.",
        evidence: [{ type: "url", ref: url }],
      },
    ];
  },
};
