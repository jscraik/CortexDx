import { ReportManager, type DiagnosticReport } from "../storage/report-manager.js";

const managers = new Map<string, ReportManager>();

async function getManager(root: string): Promise<ReportManager> {
  let manager = managers.get(root);
  if (!manager) {
    manager = new ReportManager({ storageRoot: root });
    await manager.initialize();
    managers.set(root, manager);
  }
  return manager;
}

export async function storeConsolidatedReport(
  storageRoot: string | undefined,
  report: DiagnosticReport,
): Promise<void> {
  if (!storageRoot) return;
  const manager = await getManager(storageRoot);
  await manager.storeReport(report);
}
