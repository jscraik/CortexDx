import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptDir = path.resolve(__dirname, "../prompts");

async function loadPrompt(name: string) {
  return readFile(path.join(promptDir, name), "utf8");
}

describe("story prompt templates", () => {
  it("matches narrator template contract", async () => {
    const narrator = (await loadPrompt("narrator.prompt.md")).trim();
    expect(narrator).toMatchInlineSnapshot(`
"[ROLE]: Narrator
[CONTEXT]: Dependency path = [PROMPT]
[EVENTS]: [PROMPT]
[ASK]: Offer the least-risk fix as a single action.
[OUTPUT]: One-paragraph story (<=80 words), confidence %, exactly one next action (label+command)."`);
  });

  it("matches test guide template contract", async () => {
    const testGuide = (await loadPrompt("test-guide.prompt.md")).trim();
    expect(testGuide).toMatchInlineSnapshot(`
"[ROLE]: Test Guide
[CONTEXT]: Accepted action = [PROMPT]
[STEPS]:
1) Run Probe Suite A (read-only).
2) If healthy, propose close.
3) Else branch to auth-reset script.
[OUTPUT]: Step-by-step dialog with progress chips; Stop hotkey shown."`);
  });
});
