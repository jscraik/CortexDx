import { safeParseJson } from "../utils/json.js";
import type { DiagnosticArtifacts } from "../types.js";

export function loadArtifactsFromEnv(): DiagnosticArtifacts | undefined {
  const raw =
    process.env.CORTEXDX_MANIFESTS_JSON ?? process.env.CORTEXDX_ARTIFACTS;
  if (!raw) return undefined;

  try {
    const data = safeParseJson<unknown[]>(raw, "manifest artifacts");
    if (!Array.isArray(data)) {
      return undefined;
    }
    const normalizedArtifacts = data
      .map((item) => normalizeManifestArtifact(item))
      .filter(
        (
          artifact,
        ): artifact is NonNullable<
          DiagnosticArtifacts["dependencyManifests"]
        >[number] => artifact !== null,
      );
    if (normalizedArtifacts.length === 0) {
      return undefined;
    }
    const dependencyManifests = normalizedArtifacts;
    return { dependencyManifests: normalizedArtifacts };
  } catch (error) {
    console.warn("Failed to parse CortexDx manifest artifact payload", error);
    return undefined;
  }
}

function normalizeManifestArtifact(
  value: unknown,
): NonNullable<DiagnosticArtifacts["dependencyManifests"]>[number] | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as {
    name?: unknown;
    encoding?: unknown;
    content?: unknown;
  };
  if (
    typeof candidate.name !== "string" ||
    typeof candidate.content !== "string"
  ) {
    return null;
  }
  const encoding = candidate.encoding === "base64" ? "base64" : "utf-8";
  return {
    name: candidate.name,
    encoding,
    content: candidate.content,
  };
}
