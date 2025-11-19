import { safeParseJson } from "@brainwav/cortexdx-core/utils/json.js";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ProjectContext } from "@brainwav/cortexdx-core";

const execFileAsync = promisify(execFile);
const WORKSPACE_CONFIG_CANDIDATES = [
  "pnpm-lock.yaml",
  "tsconfig.base.json",
  "tsconfig.json",
  "nx.json",
  "package.json",
  ".env.example",
  ".cortexdxrc.json",
];
const PROJECT_CONFIG_CANDIDATES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.build.json",
  "tsup.config.ts",
];

export interface ProjectContextOptions {
  workspaceRoot?: string;
  projectRoot?: string;
  projectType?: ProjectContext["type"];
  language?: string;
}

export async function loadProjectContext(
  options: ProjectContextOptions = {},
): Promise<ProjectContext | undefined> {
  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const projectRoot = resolveProjectRoot(workspaceRoot, options.projectRoot);
  const pkg = await readPackageJson(projectRoot);
  if (!pkg) return undefined;

  const dependencies = extractDependencies(pkg);
  const configFiles = collectConfigFiles(workspaceRoot, projectRoot);
  const sourceFiles = await gatherSourceFiles(workspaceRoot, projectRoot);

  return {
    name:
      (typeof pkg.name === "string" ? pkg.name : undefined) ??
      path.basename(projectRoot),
    type: options.projectType ?? inferProjectType(),
    language: options.language ?? inferLanguage(pkg),
    dependencies,
    configFiles,
    sourceFiles,
    rootPath: projectRoot,
  };
}

function resolveWorkspaceRoot(explicit?: string): string {
  if (explicit) return path.resolve(explicit);
  if (process.env.CORTEXDX_WORKSPACE_ROOT) {
    return path.resolve(process.env.CORTEXDX_WORKSPACE_ROOT);
  }
  return process.cwd();
}

function resolveProjectRoot(workspaceRoot: string, candidate?: string): string {
  const input =
    candidate ?? process.env.CORTEXDX_PROJECT_ROOT ?? "packages/cortexdx";
  const resolved = path.isAbsolute(input)
    ? input
    : path.resolve(workspaceRoot, input);
  if (existsSync(resolved)) return resolved;
  return workspaceRoot;
}

async function readPackageJson(
  projectRoot: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const pkgPath = path.join(projectRoot, "package.json");
    const raw = await readFile(pkgPath, "utf8");
    return safeParseJson<Record<string, unknown>>(raw, "project package.json");
  } catch {
    return undefined;
  }
}

function extractDependencies(pkg: Record<string, unknown>): string[] {
  const dependencies = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  return Object.keys(dependencies ?? {}).sort();
}

function collectConfigFiles(
  workspaceRoot: string,
  projectRoot: string,
): string[] {
  const files = new Set<string>();
  for (const candidate of WORKSPACE_CONFIG_CANDIDATES) {
    const abs = path.resolve(workspaceRoot, candidate);
    if (existsSync(abs)) {
      files.add(path.relative(workspaceRoot, abs) || candidate);
    }
  }
  for (const candidate of PROJECT_CONFIG_CANDIDATES) {
    const abs = path.resolve(projectRoot, candidate);
    if (existsSync(abs)) {
      files.add(path.relative(workspaceRoot, abs));
    }
  }
  return Array.from(files).sort();
}

async function gatherSourceFiles(
  workspaceRoot: string,
  projectRoot: string,
): Promise<string[]> {
  const srcDir = path.relative(workspaceRoot, path.join(projectRoot, "src"));
  if (
    !srcDir ||
    srcDir === ".." ||
    !existsSync(path.join(projectRoot, "src"))
  ) {
    return [];
  }
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--", srcDir], {
      cwd: workspaceRoot,
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function inferProjectType(): ProjectContext["type"] {
  const fromEnv = process.env.CORTEXDX_PROJECT_TYPE;
  if (
    fromEnv === "mcp-server" ||
    fromEnv === "mcp-client" ||
    fromEnv === "mcp-connector"
  ) {
    return fromEnv;
  }
  return "mcp-client";
}

function inferLanguage(pkg: Record<string, unknown>): string {
  if (
    typeof pkg?.engines === "object" &&
    pkg?.engines !== null &&
    "node" in (pkg.engines as Record<string, unknown>)
  ) {
    return "typescript";
  }
  return process.env.CORTEXDX_PROJECT_LANGUAGE ?? "typescript";
}
