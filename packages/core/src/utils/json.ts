export function safeParseJson<T = unknown>(
  payload: string,
  context = "JSON payload",
): T {
  try {
    // nosem mcp-unsafe-deserialization -- centralized safe parsing wrapper
    return JSON.parse(payload) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON for ${context}: ${message}`);
  }
}
