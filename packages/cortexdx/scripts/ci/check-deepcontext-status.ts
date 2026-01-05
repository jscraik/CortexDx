import { existsSync } from "node:fs";
import process from "node:process";
import {
  formatStatusLine,
  readAllDeepContextStatuses,
  resolveStateStorePath,
} from "../../src/deepcontext/status-store.js";

async function main(): Promise<void> {
  const statePath = resolveStateStorePath();
  if (!existsSync(statePath)) {
    console.error(`[DEEPCONTEXT] Status file missing: ${statePath}`);
    console.error(
      "Run `cortexdx deepcontext index <repo>` locally before pushing so CI can verify the cached index.",
    );
    process.exit(1);
  }

  const records = await readAllDeepContextStatuses();
  if (records.length === 0) {
    console.error(
      `[DEEPCONTEXT] No DeepContext status entries found in ${statePath}`,
    );
    process.exit(1);
  }

  console.log(
    `[DEEPCONTEXT] Loaded ${records.length} status entries from ${statePath}`,
  );
  for (const record of records) {
    console.log(`[DEEPCONTEXT] ${formatStatusLine(record)}`);
  }

  if (!records.some((record) => record.state === "ready")) {
    console.error(
      "[DEEPCONTEXT] No READY indices detected. Run `cortexdx deepcontext index <repo>` before pushing.",
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[DEEPCONTEXT] Status check failed:", error);
  process.exit(1);
});
