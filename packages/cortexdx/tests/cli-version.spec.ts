import { describe, expect, it } from "vitest";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };

describe("CLI version flag", () => {
  it("prints the workspace package version", async () => {
    const output: string[] = [];
    const errors: string[] = [];

    const cmd = new Command();
    cmd.name("cortexdx").version(packageJson.version);

    cmd.configureOutput({
      writeOut: (str) => output.push(str),
      writeErr: (str) => errors.push(str),
      outputError: (str) => errors.push(str),
    });

    cmd.exitOverride();

    await expect(
      cmd.parseAsync(["node", "cortexdx", "--version"], {
        from: "user",
      }),
    ).rejects.toMatchObject({ exitCode: 0 });

    expect(output.join("").trim()).toBe(packageJson.version);
    expect(errors.join("")).toBe("");
  });
});
