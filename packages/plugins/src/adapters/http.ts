/**
 * Custom error class for HTTP errors (non-2xx status codes)
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

/**
 * Custom error class for response parsing errors
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly contentType: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Custom error class for network/request errors
 */
export class RequestError extends Error {
  constructor(
    message: string,
    public readonly url: string,
  ) {
    super(`HTTP request to ${url} failed: ${message}`);
    this.name = "RequestError";
  }
}

export async function httpAdapter<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : "unknown";

  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      throw new HttpError(res.status, res.statusText, url);
    }

    if (contentType.includes("application/json")) {
      try {
        return (await res.json()) as T;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ParseError(
          `Failed to parse JSON response: ${message}`,
          contentType,
        );
      }
    }

    try {
      return (await res.text()) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ParseError(
        `Failed to read response text: ${message}`,
        contentType,
      );
    }
  } catch (error) {
    if (error instanceof HttpError || error instanceof ParseError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new RequestError(message, url);
  }
}
