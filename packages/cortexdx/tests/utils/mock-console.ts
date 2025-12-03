import { vi } from "vitest";

type ConsoleMethod = "log" | "info" | "warn" | "error";

export function mockConsole() {
  const logs: Array<{ level: ConsoleMethod; args: unknown[] }> = [];
  const spies = (["log", "info", "warn", "error"] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push({ level, args });
    }),
  );

  const restore = () => {
    spies.forEach((spy) => spy.mockRestore());
  };

  const getLogs = () => logs.slice();

  return { getLogs, restore };
}
