export async function httpAdapter<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    if (contentType.includes("application/json")) {
      try {
        return (await res.json()) as T;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse JSON response: ${message}`);
      }
    }

    try {
      return (await res.text()) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read response text: ${message}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("HTTP ")) {
      throw error; // Re-throw HTTP errors as-is
    }
    if (error instanceof Error && error.message.startsWith("Failed to ")) {
      throw error; // Re-throw parsing errors as-is
    }
    const message = error instanceof Error ? error.message : String(error);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : "unknown";
    throw new Error(`HTTP request to ${url} failed: ${message}`);
  }
}
