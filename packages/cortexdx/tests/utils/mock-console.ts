import { vi } from "vitest";

/**
 * Mock console utilities for testing
 */
export function mockConsole() {
    const logs: string[] = [];
    const originalConsoleLog = console.log;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
    });

    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        logs.push(`[WARN] ${args.map(String).join(" ")}`);
    });

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        logs.push(`[ERROR] ${args.map(String).join(" ")}`);
    });

    return {
        getLogs: () => [...logs],
        clearLogs: () => {
            logs.length = 0;
        },
        restore: () => {
            console.log = originalConsoleLog;
            vi.restoreAllMocks();
        },
    };
}
