import { safeParseJson } from "../utils/json.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { resolveCodexContextDir } from "./status-store.js";

const API_KEY_ENV_PRIORITY = [
  "WILDCARD_API_KEY",
  "DEEPCONTEXT_API_KEY",
  "DEEPCONTEXT_API_TOKEN",
  "DEEPCONTEXT_TOKEN",
];

export interface DeepContextClientOptions {
  logger?: (message: string) => void;
  packageSpecifier?: string;
  command?: string;
  args?: string[];
  jinaApiKey?: string;
  turbopufferApiKey?: string;
  wildcardApiKey?: string;
}

export interface DeepContextSearchMatch {
  file_path: string;
  start_line: number;
  end_line: number;
  language?: string;
  content?: string;
  score?: number;
  symbols?: string[];
  connections?: unknown;
}

export interface DeepContextSearchResult {
  text: string;
  matches: DeepContextSearchMatch[];
  meta?: Record<string, unknown>;
}

export class DeepContextClient {
  private readonly logger?: (message: string) => void;
  private readonly packageSpecifier: string;
  private readonly command: string;
  private readonly args: string[];
  private readonly apiKey?: string;
  private readonly jinaApiKey?: string;
  private readonly turbopufferApiKey?: string;

  constructor(options: DeepContextClientOptions = {}) {
    this.logger = options.logger;
    this.packageSpecifier =
      options.packageSpecifier ?? "@wildcard-ai/deepcontext@latest";
    this.command = options.command ?? "npx";
    this.args = options.args ?? ["-y", this.packageSpecifier];
    this.apiKey = resolveDeepContextApiKey(options.wildcardApiKey);
    this.jinaApiKey = options.jinaApiKey ?? process.env.JINA_API_KEY;
    this.turbopufferApiKey =
      options.turbopufferApiKey ?? process.env.TURBOPUFFER_API_KEY;
  }

  public async indexCodebase(
    codebasePath: string,
    forceReindex = false,
  ): Promise<string> {
    const resolvedPath = this.ensureAbsolutePath(codebasePath);
    const result = await this.runTool(
      "index_codebase",
      {
        codebase_path: resolvedPath,
        force_reindex: forceReindex,
      },
      resolvedPath,
    );
    return result.text;
  }

  public async getIndexingStatus(codebasePath?: string): Promise<string> {
    const result = await this.runTool(
      "get_indexing_status",
      {
        codebase_path: codebasePath
          ? this.ensureAbsolutePath(codebasePath)
          : undefined,
      },
      codebasePath,
    );
    return result.text;
  }

  public async clearIndex(codebasePath?: string): Promise<string> {
    const result = await this.runTool(
      "clear_index",
      {
        codebase_path: codebasePath
          ? this.ensureAbsolutePath(codebasePath)
          : undefined,
      },
      codebasePath,
    );
    return result.text;
  }

  public async searchCodebase(
    codebasePath: string,
    query: string,
    maxResults = 5,
  ): Promise<DeepContextSearchResult> {
    const resolvedPath = this.ensureAbsolutePath(codebasePath);
    const result = await this.runTool(
      "search_codebase",
      {
        codebase_path: resolvedPath,
        query,
        max_results: maxResults,
      },
      resolvedPath,
    );

    const matches: DeepContextSearchMatch[] =
      result.data &&
      typeof result.data === "object" &&
      "results" in result.data &&
      Array.isArray(result.data.results)
        ? (result.data.results as DeepContextSearchMatch[])
        : [];

    return {
      text: result.text,
      matches,
      meta:
        result.data && typeof result.data === "object" && result.data !== null
          ? (result.data as Record<string, unknown>)
          : undefined,
    };
  }

  private async runTool(
    name: string,
    args: Record<string, unknown>,
    workingDirectory?: string,
  ): Promise<{ text: string; data?: unknown }> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error(
        "DeepContext API key missing. Set WILDCARD_API_KEY or DEEPCONTEXT_API_KEY in your environment.",
      );
    }

    const projectRoot = workingDirectory
      ? this.ensureAbsolutePath(workingDirectory)
      : undefined;
    const runtimeCwd = process.cwd();
    const stderrChunks: string[] = [];

    const codexContextDir = resolveCodexContextDir(projectRoot);
    await mkdir(codexContextDir, { recursive: true });

    const env = {
      ...process.env,
      WILDCARD_API_KEY: this.apiKey,
      ...(this.jinaApiKey ? { JINA_API_KEY: this.jinaApiKey } : {}),
      ...(this.turbopufferApiKey
        ? { TURBOPUFFER_API_KEY: this.turbopufferApiKey }
        : {}),
      ...(projectRoot ? { CORTEXDX_PROJECT_ROOT: projectRoot } : {}),
      CODEX_CONTEXT_DIR: process.env.CODEX_CONTEXT_DIR ?? codexContextDir,
    };

    const transport = new StdioClientTransport({
      command: this.command,
      args: this.args,
      env,
      stderr: "inherit",
    });

    const client = new Client(
      {
        name: "cortexdx",
        version: "1.0.0",
      },
      { capabilities: {} },
    );

    try {
      this.logger?.(
        `[DeepContext] call ${name} args=${JSON.stringify(args, null, 2)} cwd=${projectRoot ?? runtimeCwd}`,
      );
      await client.connect(transport);
      const child = (
        transport as unknown as {
          _process?: { stderr?: NodeJS.ReadableStream };
        }
      )._process;
      child?.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderrChunks.push(chunk);
        this.logger?.(`[DeepContext stderr] ${chunk.trim()}`);
      });
      const response = await client.callTool({
        name,
        arguments: args,
      });

      return this.serializeToolResult(response);
    } catch (error) {
      const detail = stderrChunks.join("\n");
      const message = `${String(error)}${error instanceof Error && error.stack ? `\n${error.stack}` : ""}`;
      throw new Error(
        detail ? `${message}\nDeepContext stderr:\n${detail}` : message,
      );
    } finally {
      await client.close();
      await transport.close();
    }
  }

  private serializeToolResult(result: unknown): {
    text: string;
    data?: unknown;
  } {
    const textChunks = (
      typeof result === "object" && result !== null && "content" in result
        ? ((
            result as {
              content?: Array<{
                type: string;
                text?: string;
                resource?: { uri: string };
              }>;
            }
          ).content ?? [])
        : []
    )
      .map(
        (item: { type: string; text?: string; resource?: { uri: string } }) => {
          if (
            item.type === "text" &&
            "text" in item &&
            typeof item.text === "string"
          ) {
            return item.text;
          }
          if (item.type === "resource" && "resource" in item) {
            return `resource:${item.resource?.uri ?? ""}`;
          }
          return "";
        },
      )
      .filter(Boolean);

    const combinedText = textChunks.join("\n").trim();
    let data: unknown;
    if (combinedText.startsWith("{") || combinedText.startsWith("[")) {
      try {
        data = safeParseJson(combinedText);
      } catch {
        // Ignore parse errors and fall back to raw text
      }
    }
    return { text: combinedText, data };
  }

  private ensureAbsolutePath(codebasePath: string): string {
    const resolved = path.resolve(codebasePath);
    if (!existsSync(resolved)) {
      throw new Error(`Codebase path does not exist: ${resolved}`);
    }
    return resolved;
  }
}

export function resolveDeepContextApiKey(
  explicit?: string,
): string | undefined {
  if (explicit?.trim()) return explicit.trim();
  for (const key of API_KEY_ENV_PRIORITY) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}
