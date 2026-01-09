import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getStateManager, type StateManager } from "./state-manager.js";

const DEFAULT_STATE_DIR = join(process.cwd(), ".cortexdx", "workflow-state.db");

export function resolveStateDbPath(dbPath?: string): string {
  return dbPath ?? process.env.CORTEXDX_STATE_DB ?? DEFAULT_STATE_DIR;
}

export function getOrchestrationStateManager(dbPath?: string): StateManager {
  const resolvedPath = resolveStateDbPath(dbPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  return getStateManager({
    dbPath: resolvedPath,
    enableAutoSave: true,
    autoSaveIntervalMs: 5000,
    maxCheckpoints: 200,
  });
}
