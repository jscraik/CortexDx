export function extractTargetLabel(endpoint: unknown): string {
  if (typeof endpoint !== "string" || endpoint.trim().length === 0) {
    return "client MCP";
  }
  try {
    const url = new URL(endpoint);
    return url.hostname || endpoint;
  } catch {
    return endpoint;
  }
}

export function extractTargetSlug(endpoint: unknown): string {
  const label = extractTargetLabel(endpoint).toLowerCase();
  const slug = label.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "client-mcp";
}
