import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

describe("Web Interface", () => {
  it("should have index.html file", async () => {
    const indexPath = join(__dirname, "../src/web/index.html");
    const content = await readFile(indexPath, "utf-8");

    expect(content).toContain("CortexDx");
    expect(content).toContain("Development Interface");
  });

  it("should have styles.css file", async () => {
    const stylesPath = join(__dirname, "../src/web/styles.css");
    const content = await readFile(stylesPath, "utf-8");

    expect(content).toContain(":root");
    expect(content).toContain("--primary-color");
  });

  it("should have app.js file", async () => {
    const appPath = join(__dirname, "../src/web/app.js");
    const content = await readFile(appPath, "utf-8");

    expect(content).toContain("CortexDxClient");
    expect(content).toContain("setupTabs");
  });

  it("should have all required tabs in HTML", async () => {
    const indexPath = join(__dirname, "../src/web/index.html");
    const content = await readFile(indexPath, "utf-8");

    expect(content).toContain('data-tab="diagnose"');
    expect(content).toContain('data-tab="plugins"');
    expect(content).toContain('data-tab="conversation"');
    expect(content).toContain('data-tab="config"');
  });

  it("should have accessibility features", async () => {
    const indexPath = join(__dirname, "../src/web/index.html");
    const content = await readFile(indexPath, "utf-8");

    // Check for semantic HTML
    expect(content).toContain("<header>");
    expect(content).toContain("<nav");
    expect(content).toContain("<main>");

    // Check for labels
    expect(content).toContain("<label");
  });

  it("should use for...of instead of forEach in JavaScript", async () => {
    const appPath = join(__dirname, "../src/web/app.js");
    const content = await readFile(appPath, "utf-8");

    // Should use for...of
    expect(content).toContain("for (const");

    // Should not use forEach in main logic
    const forEachCount = (content.match(/\.forEach\(/g) || []).length;
    expect(forEachCount).toBe(0);
  });
});
