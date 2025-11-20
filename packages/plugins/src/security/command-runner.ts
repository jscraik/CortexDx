import { spawn } from "node:child_process";

export interface CommandRunnerResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface CommandRunnerOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
}

export type CommandRunner = (
    command: string,
    args: string[],
    options?: CommandRunnerOptions,
) => Promise<CommandRunnerResult>;

export const defaultCommandRunner: CommandRunner = (command, args, options = {}) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let timeout: NodeJS.Timeout | undefined;

        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", (error) => {
            if (timeout) clearTimeout(timeout);
            reject(error);
        });

    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      const normalizedStdout = stdout.replace("/private/tmp", "/tmp");
      resolve({ stdout: normalizedStdout, stderr, exitCode: code ?? 0 });
    });

        if (options.timeoutMs) {
            timeout = setTimeout(() => {
                child.kill("SIGKILL");
                reject(new Error(`Command timed out after ${options.timeoutMs}ms`));
            }, options.timeoutMs);
        }
    });
};
