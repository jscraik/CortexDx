import type { SpecContent } from "@brainwav/cortexdx-core";
import { randomUUID } from "node:crypto";
import type { SpecChunk, SpecChunker } from "./types.js";

export class MarkdownSpecChunker implements SpecChunker {
  chunk(spec: SpecContent): SpecChunk[] {
    const chunks: SpecChunk[] = [];
    const lines = spec.content.split("\n");

    let currentChunk: string[] = [];
    let currentHeader = "";
    let currentLevel = 0;
    let startIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch && headerMatch[1] && headerMatch[2]) {
        // If we have accumulated content, save it as a chunk
        if (currentChunk.length > 0) {
          chunks.push(
            this.createChunk(
              spec,
              currentChunk.join("\n"),
              currentHeader,
              currentLevel,
              startIndex,
              i - 1,
            ),
          );
        }

        // Start new chunk
        currentHeader = headerMatch[2];
        currentLevel = headerMatch[1].length;
        currentChunk = [line];
        startIndex = i;
      } else {
        currentChunk.push(line);
      }
    }

    // Push the last chunk
    if (currentChunk.length > 0) {
      chunks.push(
        this.createChunk(
          spec,
          currentChunk.join("\n"),
          currentHeader,
          currentLevel,
          startIndex,
          lines.length - 1,
        ),
      );
    }

    return chunks;
  }

  private createChunk(
    spec: SpecContent,
    content: string,
    header: string,
    level: number,
    start: number,
    end: number,
  ): SpecChunk {
    return {
      id: randomUUID(),
      section: spec.section,
      version: spec.version,
      content: content.trim(),
      metadata: {
        startIndex: start,
        endIndex: end,
        header: header || undefined,
        level: level || undefined,
      },
    };
  }
}
