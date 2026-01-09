import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildStatusRecord,
  persistDeepContextStatus,
  readDeepContextStatus,
  resolveStateStorePath,
} from "../src/deepcontext/status-store.js";

const ORIGINAL_ENV = { ...process.env };

describe("DeepContext status store", () => {
  let workspaceDir: string;
  let codexDir: string;
  let stateFile: string;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(path.join(tmpdir(), "cortexdx-status-"));
    codexDir = path.join(workspaceDir, ".codex-context");
    stateFile = path.join(workspaceDir, "status.json");
    process.env.CODEX_CONTEXT_DIR = codexDir;
    process.env.CORTEXDX_DEEPCONTEXT_STATE = stateFile;
    await mkdir(path.join(workspaceDir, "repo"), { recursive: true });
  });

  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    await rm(workspaceDir, { recursive: true, force: true });
  });

  it("marks status as ready when indexed artifacts exist", async () => {
    const codebasePath = path.join(workspaceDir, "repo");
    await mkdir(codexDir, { recursive: true });
    const snapshot = JSON.stringify([{ path: codebasePath }]);
    await writeFile(
      path.join(codexDir, "indexed-codebases.json"),
      snapshot,
      "utf8",
    );

    const record = await buildStatusRecord({
      codebasePath,
      remoteStatusText: "ready",
    });
    expect(record.state).toBe("ready");
    await persistDeepContextStatus(record);

    const loaded = await readDeepContextStatus(codebasePath);
    expect(loaded?.state).toBe("ready");
    expect(resolveStateStorePath()).toBe(stateFile);
  });

  it("detects missing artifacts as not indexed", async () => {
    const codebasePath = path.join(workspaceDir, "repo");
    const record = await buildStatusRecord({
      codebasePath,
      remoteStatusText: "no index present",
    });
    expect(record.state).toBe("not_indexed");
  });
});
