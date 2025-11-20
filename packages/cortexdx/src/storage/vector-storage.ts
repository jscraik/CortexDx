export * from "../../../plugins/src/storage/vector-storage.ts";

// Provide a synchronous factory that matches the interface expected by
// CortexDx tests. The plugins package exposes an async factory, but the
// CLI/tests invoke it without awaiting the Promise. Using the concrete
// SQLite implementation keeps behaviour deterministic while satisfying the
// synchronous call pattern.
import { SQLiteVectorStorage } from "../../../plugins/src/storage/vector-storage.js";
import type { IVectorStorage } from "../../../plugins/src/storage/vector-storage.js";

export function createVectorStorage(
  dbPath = ".cortexdx/vector-storage.db",
): IVectorStorage {
  return new SQLiteVectorStorage(dbPath);
}
