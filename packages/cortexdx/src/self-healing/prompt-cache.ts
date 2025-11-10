import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export class PromptCache {
  private readonly cacheDir: string;

  constructor(baseDir: string) {
    this.cacheDir = baseDir;
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  computeKey(payload: Record<string, unknown>): string {
    const serialized = JSON.stringify(payload);
    return createHash("sha256").update(serialized).digest("hex");
  }

  read(key: string): string | null {
    const file = this.cachePathFor(key);
    if (!fs.existsSync(file)) {
      return null;
    }
    return fs.readFileSync(file, "utf-8");
  }

  write(key: string, content: string): string {
    const file = this.cachePathFor(key);
    fs.writeFileSync(file, content, "utf-8");
    return file;
  }

  getDirectory(): string {
    return this.cacheDir;
  }

  private cachePathFor(key: string, extension = "txt"): string {
    return path.join(this.cacheDir, `${key}.${extension}`);
  }
}
