/**
 * Tests for Unified Flame Graph Generator
 */

import { describe, expect, it } from "vitest";
import {
  FlameGraphGenerator,
  type FlameGraphData,
  type FlameGraphNode,
  type FlameGraphOptions,
} from "../src/report/flamegraph.js";

describe("Unified Flame Graph Generator", () => {
  describe("FlameGraphGenerator", () => {
    it("should generate SVG flame graph", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
        children: [
          {
            name: "function_a",
            value: 600,
            children: [
              { name: "function_a1", value: 300 },
              { name: "function_a2", value: 300 },
            ],
          },
          {
            name: "function_b",
            value: 400,
            children: [{ name: "function_b1", value: 400 }],
          },
        ],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp: new Date("2025-01-01T00:00:00Z"),
          source: "clinic.js",
          tool: "flame",
        },
      };

      const options: FlameGraphOptions = {
        format: "svg",
        width: 1200,
        height: 800,
      };

      const svg = await generator.generate(data, options);

      expect(svg).toContain('<?xml version="1.0"');
      expect(svg).toContain("<svg");
      expect(svg).toContain("Flame Graph");
      expect(svg).toContain("1000 samples");
      expect(svg).toContain("function_a");
      expect(svg).toContain("function_b");
    });

    it("should generate HTML flame graph with interactive features", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
        children: [
          { name: "function_a", value: 600 },
          { name: "function_b", value: 400 },
        ],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp: new Date("2025-01-01T00:00:00Z"),
          source: "py-spy",
          tool: "pyspy",
          pid: 12345,
          command: "python server.py",
        },
      };

      const options: FlameGraphOptions = {
        format: "html",
        interactive: true,
        title: "Python Performance Profile",
      };

      const html = await generator.generate(data, options);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Python Performance Profile");
      expect(html).toContain("resetZoom");
      expect(html).toContain("searchFrame");
      expect(html).toContain("downloadSVG");
      expect(html).toContain("downloadJSON");
      expect(html).toContain("Total Samples");
      expect(html).toContain("1,000");
      expect(html).toContain("PID");
      expect(html).toContain("12345");
      expect(html).toContain("python server.py");
    });

    it("should generate JSON flame graph data", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
        children: [{ name: "function_a", value: 1000 }],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp: new Date("2025-01-01T00:00:00Z"),
          source: "custom",
        },
      };

      const options: FlameGraphOptions = {
        format: "json",
      };

      const json = await generator.generate(data, options);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty("root");
      expect(parsed).toHaveProperty("metadata");
      expect(parsed.root.name).toBe("root");
      expect(parsed.root.value).toBe(1000);
      expect(parsed.metadata.totalSamples).toBe(1000);
      expect(parsed.metadata.source).toBe("custom");
    });

    it("should support different color schemes", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 100,
        children: [{ name: "child", value: 100 }],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 100,
          duration: 1000,
          timestamp: new Date(),
          source: "clinic.js",
        },
      };

      const colorSchemes = ["hot", "cold", "aqua", "green", "red"] as const;

      for (const colorScheme of colorSchemes) {
        const options: FlameGraphOptions = {
          format: "svg",
          colorScheme,
        };

        const svg = await generator.generate(data, options);
        expect(svg).toContain("<svg");
        expect(svg).toContain("hsl(");
      }
    });

    it("should include metadata in SVG output", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
      };

      const timestamp = new Date("2025-01-01T12:00:00Z");
      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp,
          source: "clinic.js",
          tool: "flame",
        },
      };

      const options: FlameGraphOptions = {
        format: "svg",
      };

      const svg = await generator.generate(data, options);

      expect(svg).toContain("Source: clinic.js");
      expect(svg).toContain("Generated:");
      expect(svg).toContain("1000 samples");
      expect(svg).toContain("5000ms");
    });

    it("should handle nested function hierarchies", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
        children: [
          {
            name: "level1",
            value: 1000,
            children: [
              {
                name: "level2",
                value: 1000,
                children: [
                  {
                    name: "level3",
                    value: 1000,
                    children: [{ name: "level4", value: 1000 }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp: new Date(),
          source: "py-spy",
        },
      };

      const options: FlameGraphOptions = {
        format: "svg",
      };

      const svg = await generator.generate(data, options);

      expect(svg).toContain("level1");
      expect(svg).toContain("level2");
      expect(svg).toContain("level3");
      expect(svg).toContain("level4");
    });

    it("should parse Clinic.js flame graph data", async () => {
      const generator = new FlameGraphGenerator();

      const data = await generator.parseClinicFlameGraph("/path/to/flame.svg", {
        totalSamples: 5000,
        duration: 10000,
        timestamp: new Date(),
        tool: "flame",
        pid: 12345,
        command: "node server.js",
      });

      expect(data.root).toBeDefined();
      expect(data.metadata.source).toBe("clinic.js");
      expect(data.metadata.tool).toBe("flame");
      expect(data.metadata.totalSamples).toBe(5000);
      expect(data.metadata.duration).toBe(10000);
      expect(data.metadata.pid).toBe(12345);
      expect(data.metadata.command).toBe("node server.js");
    });

    it("should parse py-spy flame graph data", async () => {
      const generator = new FlameGraphGenerator();

      const data = await generator.parsePySpyFlameGraph("/path/to/flame.svg", {
        totalSamples: 3000,
        duration: 8000,
        timestamp: new Date(),
        pid: 54321,
        command: "python app.py",
      });

      expect(data.root).toBeDefined();
      expect(data.metadata.source).toBe("py-spy");
      expect(data.metadata.tool).toBe("pyspy");
      expect(data.metadata.totalSamples).toBe(3000);
      expect(data.metadata.duration).toBe(8000);
      expect(data.metadata.pid).toBe(54321);
      expect(data.metadata.command).toBe("python app.py");
    });

    it("should parse speedscope JSON format", async () => {
      const generator = new FlameGraphGenerator();

      const data = await generator.parseSpeedscopeJSON(
        "/path/to/profile.json",
        {
          totalSamples: 2000,
          duration: 6000,
          timestamp: new Date(),
          source: "custom",
        },
      );

      expect(data.root).toBeDefined();
      expect(data.metadata.totalSamples).toBe(2000);
      expect(data.metadata.duration).toBe(6000);
    });

    it("should handle custom dimensions", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 100,
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 100,
          duration: 1000,
          timestamp: new Date(),
          source: "clinic.js",
        },
      };

      const options: FlameGraphOptions = {
        format: "svg",
        width: 800,
        height: 600,
      };

      const svg = await generator.generate(data, options);

      expect(svg).toContain('width="800"');
      expect(svg).toContain('height="600"');
    });

    it("should truncate long function names in narrow frames", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 1000,
        children: [
          {
            name: "short",
            value: 900,
          },
          {
            name: "this_is_a_very_long_function_name_that_should_be_truncated_in_the_output",
            value: 100, // Small value = narrow frame
          },
        ],
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 1000,
          duration: 5000,
          timestamp: new Date(),
          source: "clinic.js",
        },
      };

      const options: FlameGraphOptions = {
        format: "svg",
        width: 1200,
      };

      const svg = await generator.generate(data, options);

      // The long name in the narrow frame should be truncated with "..."
      expect(svg).toContain("...");
    });

    it("should throw error for unsupported format", async () => {
      const generator = new FlameGraphGenerator();

      const root: FlameGraphNode = {
        name: "root",
        value: 100,
      };

      const data: FlameGraphData = {
        root,
        metadata: {
          totalSamples: 100,
          duration: 1000,
          timestamp: new Date(),
          source: "clinic.js",
        },
      };

      const options = {
        format: "pdf" as any,
      };

      await expect(generator.generate(data, options)).rejects.toThrow(
        "Unsupported format",
      );
    });
  });
});
