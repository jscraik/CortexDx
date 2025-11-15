export type McpDocsManifestSource = {
  id: string;
  type: "page" | "spec" | "repo";
  url?: string;
  sha256: string;
  artifact: string;
  chunks: number;
  metadata?: Record<string, unknown>;
};

export type McpDocsGitSource = McpDocsManifestSource & {
  commit: string;
};

export type McpDocsManifest = {
  version: string;
  createdAt: string;
  sources: McpDocsManifestSource[];
  git?: McpDocsGitSource[];
  spec?: {
    baseUrl: string;
    slugs: string[];
  };
  chunkCount: number;
};

export type McpDocsChunkRecord = {
  id: string;
  version: string;
  sourceId: string;
  url: string;
  order: number;
  title?: string;
  text: string;
  sha256: string;
};

export type McpDocsSnapshot = {
  manifest: McpDocsManifest;
  chunks: McpDocsChunkRecord[];
  manifestPath: string;
  chunksPath: string;
};

export type McpDocsSourceInfo = McpDocsManifestSource | McpDocsGitSource;
