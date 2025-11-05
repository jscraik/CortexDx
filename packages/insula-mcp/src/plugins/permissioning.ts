import type { DiagnosticPlugin, Finding } from "../types.js";

interface ToolLike {
  name?: string;
  description?: string;
}

const RULES: Array<{ re: RegExp; tag: string; severity: "major" | "minor" }> = [
  { re: /\b(exec|shell|bash|sh|powershell)\b/i, tag: "exec", severity: "major" },
  { re: /\b(fs|filesystem|write|delete|rm|unlink|chmod|chown)\b/i, tag: "filesystem", severity: "major" },
  { re: /\b(sql|sqlite|postgres|mysql|query)\b/i, tag: "sql", severity: "major" },
  { re: /\b(curl|http|get|post|fetch|open[-_ ]?url)\b/i, tag: "net", severity: "minor" }
];

function classify(tool: ToolLike) {
  const haystack = `${tool.name ?? ""} ${tool.description ?? ""}`;
  return RULES.filter((rule) => rule.re.test(haystack));
}

export const PermissioningPlugin: DiagnosticPlugin = {
  id: "permissioning",
  title: "Tool Permissioning (least-privilege)",
  order: 135,
  async run(ctx) {
    const findings: Finding[] = [];
    const list = await ctx.jsonrpc<unknown>("tools/list").catch(() => null);
    const tools = normalizeTools(list);

    if (!tools.length) {
      return [
        {
          id: "perm.tools.unknown",
          area: "permissioning",
          severity: "minor",
          title: "Unable to assess tool permissioning",
          description: "Discovery returned no tools (or unknown shape).",
          evidence: [{ type: "url", ref: ctx.endpoint }]
        }
      ];
    }

    let flagged = 0;
    for (const tool of tools) {
      for (const hit of classify(tool)) {
        flagged += 1;
        findings.push({
          id: `perm.${hit.tag}.${tool.name ?? "unnamed"}`,
          area: "permissioning",
          severity: hit.severity,
          title: `Potentially over-privileged tool: ${tool.name ?? "(unnamed)"}`,
          description: `Heuristic match: ${hit.tag}. Review least-privilege and confirmation prompts.`,
          evidence: [{ type: "log", ref: `tool:${tool.name ?? "unnamed"}` }],
          tags: ["least-privilege", hit.tag],
          confidence: 0.75
        });
      }
    }

    if (flagged === 0) {
      findings.push({
        id: "perm.clean",
        area: "permissioning",
        severity: "info",
        title: "No obvious over-privileged tools detected",
        description: "Heuristics found no risky verbs in tool names/descriptions.",
        evidence: [{ type: "url", ref: ctx.endpoint }]
      });
    }

    return findings;
  }
};

function normalizeTools(value: unknown): ToolLike[] {
  const collection = extractTools(value);
  if (!collection) return [];
  return collection.filter(isToolLike);
}

function extractTools(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const maybeTools = (value as { tools?: unknown }).tools;
    if (Array.isArray(maybeTools)) return maybeTools;
  }
  return null;
}

function isToolLike(value: unknown): value is ToolLike {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { name?: unknown; description?: unknown };
  const validName = candidate.name === undefined || typeof candidate.name === "string";
  const validDescription =
    candidate.description === undefined || typeof candidate.description === "string";
  return validName && validDescription;
}
