import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSQLitePatternStorage } from "../storage/pattern-storage-sqlite.js";
import type { EnhancedPatternStorage } from "../storage/pattern-storage.js";

let storage: EnhancedPatternStorage | null = null;

export function getPatternStorage(): EnhancedPatternStorage {
    if (storage) {
        return storage;
    }
    const dbPath = process.env.CORTEXDX_PATTERN_DB ?? join(process.cwd(), ".cortexdx", "patterns.db");
    mkdirSync(dirname(dbPath), { recursive: true });
    storage = createSQLitePatternStorage(dbPath, process.env.CORTEXDX_PATTERN_KEY);
    return storage;
}
