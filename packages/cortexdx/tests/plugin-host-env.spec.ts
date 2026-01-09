/**
 * Plugin host environment ingestion tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __test as pluginHostInternals } from "../src/plugin-host.js";

type TestInternals = {
  loadArtifactsFromEnv: () =>
    | {
        dependencyManifests?: Array<{
          name: string;
          encoding: "utf-8" | "base64";
          content: string;
        }>;
      }
    | undefined;
};

const internals = pluginHostInternals as TestInternals | undefined;

if (!internals) {
  throw new Error("plugin-host test internals are not exposed");
}

const { loadArtifactsFromEnv } = internals;

const manifestEnvKeys = ["CORTEXDX_MANIFESTS_JSON"] as const;
const originalEnv: Record<
  (typeof manifestEnvKeys)[number],
  string | undefined
> = {
  CORTEXDX_MANIFESTS_JSON: undefined,
};

beforeEach(() => {
  for (const key of manifestEnvKeys) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of manifestEnvKeys) {
    const value = originalEnv[key];
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

describe("loadArtifactsFromEnv", () => {
  it("should parse manifests from CORTEXDX_MANIFESTS_JSON", () => {
    process.env.CORTEXDX_MANIFESTS_JSON = JSON.stringify([
      { name: "package.json", encoding: "utf-8", content: '{"name":"demo"}' },
      {
        name: "requirements.txt",
        encoding: "base64",
        content: "cmVxdWVzdHM9Mi4zLjE=\n",
      },
    ]);

    const artifacts = loadArtifactsFromEnv();

    expect(artifacts).toBeDefined();
    expect(artifacts?.dependencyManifests).toHaveLength(2);
    expect(artifacts?.dependencyManifests?.[0]).toMatchObject({
      name: "package.json",
      encoding: "utf-8",
      content: '{"name":"demo"}',
    });
    expect(artifacts?.dependencyManifests?.[1]).toMatchObject({
      name: "requirements.txt",
      encoding: "base64",
      content: "cmVxdWVzdHM9Mi4zLjE=\n",
    });
  });

  it("returns undefined when manifests are not provided", () => {
    delete process.env.CORTEXDX_MANIFESTS_JSON;
    const artifacts = loadArtifactsFromEnv();
    expect(artifacts).toBeUndefined();
  });
});
