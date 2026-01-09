/// <reference lib="dom" />

import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import TurndownService from "turndown";
import { JSDOM, VirtualConsole } from "jsdom";
import type {
  McpDocsChunkRecord as ChunkRecord,
  McpDocsManifest as Manifest,
  McpDocsManifestSource as ManifestSource,
} from "@brainwav/cortexdx/library/mcp-docs.js";

const execFileAsync = promisify(execFile);

type StaticPageSource = {
  id: string;
  url: string;
  title?: string;
};

type SpecConfig = {
  baseUrl: string;
  defaultVersion?: string;
  initialSlugs?: string[];
};

type GitRepoSource = {
  id: string;
  url: string;
  ref?: string;
  paths: string[];
};

type SourceConfig = {
  staticPages?: StaticPageSource[];
  spec?: SpecConfig;
  gitRepos?: GitRepoSource[];
};

const CONFIG_PATH = path.resolve("config/mcp-docs-sources.json");
const OUTPUT_ROOT = path.resolve(".cortexdx/library/mcp-docs");
const STAGING_ROOT = path.join(OUTPUT_ROOT, "_staging");
const DEFAULT_CHUNK_SIZE = 1600;
const CHUNK_OVERLAP = 200;

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

async function main(): Promise<void> {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Source config missing at ${CONFIG_PATH}`);
  }

  const config: SourceConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const cliArgs = parseArgs(process.argv.slice(2));
  const version =
    cliArgs.version ?? config.spec?.defaultVersion ?? timestampVersion();
  const stageDir = path.join(STAGING_ROOT, version);

  await prepareDir(stageDir);
  const manifest: Manifest = {
    version,
    createdAt: new Date().toISOString(),
    sources: [],
    chunkCount: 0,
  };
  const chunks: ChunkRecord[] = [];

  if (config.staticPages?.length) {
    for (const page of config.staticPages) {
      const result = await processPage(page, stageDir, version);
      manifest.sources.push(result.manifestEntry);
      chunks.push(...result.chunks);
    }
  }

  if (config.spec) {
    const specResult = await processSpec(config.spec, stageDir, version);
    if (specResult) {
      manifest.spec = {
        baseUrl: config.spec.baseUrl,
        slugs: specResult.slugs,
      };
      manifest.sources.push(...specResult.manifestEntries);
      chunks.push(...specResult.chunks);
    }
  }

  if (config.gitRepos?.length) {
    const repoManifests: Array<ManifestSource & { commit: string }> = [];
    for (const repo of config.gitRepos) {
      const result = await processRepo(repo, stageDir, version);
      repoManifests.push(result.manifestEntry);
      chunks.push(...result.chunks);
    }
    if (repoManifests.length > 0) {
      manifest.git = repoManifests;
    }
  }

  manifest.chunkCount = chunks.length;
  const chunksPath = path.join(stageDir, "chunks.jsonl");
  const manifestPath = path.join(stageDir, "manifest.json");
  await writeFile(
    chunksPath,
    chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n",
    "utf8",
  );
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`✅ MCP docs snapshot complete for version ${version}`);
  console.log(`   - Manifest: ${manifestPath}`);
  console.log(`   - Chunks:   ${chunksPath} (${chunks.length} chunks)`);
}

type PageProcessResult = {
  manifestEntry: ManifestSource;
  chunks: ChunkRecord[];
};

async function processPage(
  page: StaticPageSource,
  stageDir: string,
  version: string,
  sourcePrefix = "page",
): Promise<PageProcessResult> {
  const response = await fetchText(page.url);
  const markdown = htmlToMarkdown(response.html);
  const pageDir = path.join(stageDir, "pages");
  await mkdir(pageDir, { recursive: true });
  const fileName = `${slugify(`${sourcePrefix}-${page.id}`)}.md`;
  const filePath = path.join(pageDir, fileName);
  await writeFile(filePath, markdown.markdown, "utf8");

  const sourceId = `${sourcePrefix}-${page.id}`;
  const chunks = chunkMarkdown(markdown.markdown, {
    sourceId,
    version,
    url: page.url,
    title: page.title ?? markdown.title ?? page.id,
  });

  return {
    manifestEntry: {
      id: sourceId,
      type: sourcePrefix === "page" ? "page" : "spec",
      url: page.url,
      sha256: response.sha256,
      artifact: path.relative(stageDir, filePath),
      chunks: chunks.length,
      metadata: page.title ? { title: page.title } : undefined,
    },
    chunks,
  };
}

type SpecProcessResult = {
  slugs: string[];
  manifestEntries: ManifestSource[];
  chunks: ChunkRecord[];
};

async function processSpec(
  specConfig: SpecConfig,
  stageDir: string,
  version: string,
): Promise<SpecProcessResult | null> {
  const slugs = await discoverSpecSlugs(specConfig, version);
  const entries: ManifestSource[] = [];
  const chunks: ChunkRecord[] = [];

  for (const slug of slugs) {
    const url = `${trimTrailingSlash(specConfig.baseUrl)}/specification/${version}/${slug}`;
    const pageResult = await processPage(
      { id: slug, url, title: `MCP Spec ${version} — ${slug}` },
      stageDir,
      version,
      "spec",
    );
    entries.push(pageResult.manifestEntry);
    chunks.push(...pageResult.chunks);
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    slugs,
    manifestEntries: entries,
    chunks,
  };
}

async function discoverSpecSlugs(
  config: SpecConfig,
  version: string,
): Promise<string[]> {
  const fallbackSlugs = new Set(config.initialSlugs ?? []);
  const probeUrl = `${trimTrailingSlash(config.baseUrl)}/specification/${version}/basic`;
  try {
    const response = await fetchText(probeUrl);
    const regex = new RegExp(`/specification/${version}/([a-z0-9-]+)`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(response.html)) !== null) {
      fallbackSlugs.add(match[1]);
    }
  } catch (error) {
    console.warn(
      `⚠️  Unable to crawl spec navigation (${String(error)}) – using configured slugs only.`,
    );
  }

  if (!fallbackSlugs.has("basic")) {
    fallbackSlugs.add("basic");
  }
  return Array.from(fallbackSlugs).sort();
}

type RepoProcessResult = {
  manifestEntry: ManifestSource & { commit: string };
  chunks: ChunkRecord[];
};

async function processRepo(
  repo: GitRepoSource,
  stageDir: string,
  version: string,
): Promise<RepoProcessResult> {
  if (!repo.paths?.length) {
    throw new Error(`Repo ${repo.id} is missing paths array in config`);
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `mcp-docs-${repo.id}-`));
  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      repo.ref ?? "main",
      repo.url,
      tmpDir,
    ]);
    const { stdout: commitStdout } = await execFileAsync("git", [
      "-C",
      tmpDir,
      "rev-parse",
      "HEAD",
    ]);
    const commit = commitStdout.trim();

    const repoChunks: ChunkRecord[] = [];
    let fileCount = 0;
    for (const target of repo.paths) {
      const absolute = path.join(tmpDir, target);
      if (!existsSync(absolute)) {
        console.warn(`⚠️  Path ${target} not found in ${repo.id} (${repo.url})`);
        continue;
      }
      const stats = await stat(absolute);
      if (stats.isDirectory()) {
        const files = await collectMarkdownFiles(absolute);
        for (const filePath of files) {
          const rel = path.relative(tmpDir, filePath);
          const text = await readFile(filePath, "utf8");
          const sourceId = `${repo.id}/${normalizePath(rel)}`;
          repoChunks.push(
            ...chunkMarkdown(text, {
              sourceId,
              version,
              url: `${repo.url.replace(/\.git$/, "")}/blob/${commit}/${normalizePath(rel)}`,
              title: rel,
            }),
          );
          fileCount += 1;
        }
      } else if (stats.isFile()) {
        const rel = path.relative(tmpDir, absolute);
        const text = await readFile(absolute, "utf8");
        const sourceId = `${repo.id}/${normalizePath(rel)}`;
        repoChunks.push(
          ...chunkMarkdown(text, {
            sourceId,
            version,
            url: `${repo.url.replace(/\.git$/, "")}/blob/${commit}/${normalizePath(rel)}`,
            title: rel,
          }),
        );
        fileCount += 1;
      }
    }

    const manifestEntry: ManifestSource & { commit: string } = {
      id: repo.id,
      type: "repo",
      url: repo.url,
      sha256: computeSha(repo.url + commit + repo.paths.join(";")),
      artifact: `${repo.id}@${commit}`,
      chunks: repoChunks.length,
      metadata: {
        ref: repo.ref ?? "main",
        files: fileCount,
      },
      commit,
    };

    return { manifestEntry, chunks: repoChunks };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(absolute)));
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function isMarkdown(fileName: string): boolean {
  return /(\.md|\.mdx|\.markdown)$/i.test(fileName);
}

type ChunkOptions = {
  sourceId: string;
  version: string;
  url: string;
  title?: string;
};

function chunkMarkdown(markdown: string, options: ChunkOptions): ChunkRecord[] {
  const normalized = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const chunks: ChunkRecord[] = [];
  let buffer: string[] = [];
  let bufferLength = 0;
  let order = 0;

  for (const block of normalized) {
    if (bufferLength + block.length > DEFAULT_CHUNK_SIZE && buffer.length > 0) {
      const text = buffer.join("\n\n");
      chunks.push(makeChunkRecord(options, order++, text));
      buffer = overlapTail(buffer, CHUNK_OVERLAP);
      bufferLength = buffer.reduce((sum, part) => sum + part.length, 0);
    }
    buffer.push(block);
    bufferLength += block.length;
  }

  if (buffer.length > 0) {
    const text = buffer.join("\n\n");
    chunks.push(makeChunkRecord(options, order++, text));
  }

  return chunks;
}

function overlapTail(blocks: string[], targetLength: number): string[] {
  const reversed: string[] = [];
  let total = 0;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    reversed.unshift(block);
    total += block.length;
    if (total >= targetLength) {
      break;
    }
  }
  return reversed;
}

function makeChunkRecord(
  options: ChunkOptions,
  order: number,
  text: string,
): ChunkRecord {
  const chunkId = `${slugify(options.sourceId)}-${order.toString().padStart(4, "0")}`;
  return {
    id: chunkId,
    version: options.version,
    sourceId: options.sourceId,
    url: options.url,
    order,
    title: options.title,
    text: text.trim(),
    sha256: computeSha(text),
  };
}

async function fetchText(
  url: string,
): Promise<{ html: string; sha256: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "CortexDx-MCP-Indexer/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }
  const html = await res.text();
  return { html, sha256: computeSha(html) };
}

function htmlToMarkdown(html: string): { markdown: string; title?: string } {
  const vc = new VirtualConsole();
  vc.on("error", () => undefined);
  const dom = new JSDOM(html, { virtualConsole: vc });
  const title =
    dom.window.document.querySelector("title")?.textContent ?? undefined;
  const markdown = turndown.turndown(dom.window.document.body.innerHTML);
  return { markdown: markdown.trim(), title: title?.trim() };
}

async function prepareDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

function parseArgs(args: string[]): { version?: string } {
  const options: { version?: string } = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--version" && args[i + 1]) {
      options.version = args[i + 1];
      i += 1;
    }
  }
  return options;
}

function computeSha(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function timestampVersion(): string {
  return new Date().toISOString().split("T")[0];
}

main().catch((error) => {
  console.error("❌ MCP docs indexing failed", error);
  process.exitCode = 1;
});
