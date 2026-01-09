import { afterEach, describe, expect, it } from "vitest";
import {
  formatHeadersForCli,
  mergeHeaders,
  parseHeaderList,
  resolveInternalHeaders,
} from "../src/utils/internal-endpoint.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  });
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("internal endpoint header utilities", () => {
  it("parses mixed delimiter header lists", () => {
    const headers = parseHeaderList(
      "Authorization: Bearer token;X-Test: value,Another: yes",
    );
    expect(headers).toEqual({
      Authorization: "Bearer token",
      "X-Test": "value",
      Another: "yes",
    });
  });

  it("resolves headers from multiple env sources", () => {
    process.env.CORTEXDX_INTERNAL_HEADERS = "X-Trace: abc";
    process.env.CORTEXDX_INTERNAL_AUTH_HEADER = "X-Auth: secret";
    process.env.CORTEXDX_BEARER_TOKEN = "token-value";
    process.env.CF_ACCESS_CLIENT_ID = "id";
    process.env.CF_ACCESS_CLIENT_SECRET = "secret";

    const headers = resolveInternalHeaders();
    expect(headers).toEqual({
      "X-Trace": "abc",
      "X-Auth": "secret",
      Authorization: "Bearer token-value",
      "CF-Access-Client-Id": "id",
      "CF-Access-Client-Secret": "secret",
    });
  });

  it("merges default headers into request init", () => {
    const result = mergeHeaders(
      { method: "GET", headers: { Existing: "1" } },
      {
        Authorization: "Bearer token",
      },
    );

    expect(result).toEqual({
      method: "GET",
      headers: {
        Existing: "1",
        Authorization: "Bearer token",
      },
    });
  });

  it("formats headers for CLI arguments", () => {
    const args = formatHeadersForCli({
      Authorization: "Bearer token",
      "X-Test": "abc",
    });
    expect(args).toEqual([
      "--header",
      "Authorization: Bearer token",
      "--header",
      "X-Test: abc",
    ]);
  });
});
