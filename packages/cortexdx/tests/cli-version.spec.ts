import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { program } from "../src/cli.js";

describe("CLI version flag", () => {
  it("prints the workspace package version", async () => {
    const output: string[] = [];
    const errors: string[] = [];

    program.configureOutput({
      writeOut: (str) => output.push(str),
      writeErr: (str) => errors.push(str),
      outputError: (str) => errors.push(str),
    });

    program.exitOverride();

    await expect(
      program.parseAsync(["node", "cortexdx", "--version"], {
        from: "user",
      }),
    ).rejects.toMatchObject({ exitCode: 0 });

    expect(output.join("").trim()).toBe(packageJson.version);
    expect(errors.join("")).toBe("");
  });
});
