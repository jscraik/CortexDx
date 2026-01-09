/**
 * Performance Benchmarks for CortexDx
 * Run with: pnpm test:bench or vitest bench
 */

import { describe, bench } from "vitest";

describe("Performance Benchmarks", () => {
  describe("Memory Usage", () => {
    bench("should track memory allocations", () => {
      const before = process.memoryUsage().heapUsed;
      const largeArray = new Array(1000).fill({ data: "test" });
      const after = process.memoryUsage().heapUsed;

      // Ensure we're not leaking memory excessively
      const allocated = after - before;
      if (allocated > 10 * 1024 * 1024) {
        throw new Error(
          `Excessive memory allocation: ${allocated / 1024 / 1024}MB`,
        );
      }

      // Cleanup
      largeArray.length = 0;
    });
  });

  describe("Data Processing", () => {
    bench("array iteration with for loop", () => {
      const data = Array.from({ length: 10000 }, (_, i) => i);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      return sum;
    });

    bench("array iteration with forEach", () => {
      const data = Array.from({ length: 10000 }, (_, i) => i);
      let sum = 0;
      data.forEach((n) => {
        sum += n;
      });
      return sum;
    });

    bench("array iteration with reduce", () => {
      const data = Array.from({ length: 10000 }, (_, i) => i);
      return data.reduce((acc, n) => acc + n, 0);
    });
  });

  describe("JSON Operations", () => {
    const testData = {
      findings: Array.from({ length: 100 }, (_, i) => ({
        id: `finding-${i}`,
        severity: "high",
        area: "test",
        timestamp: Date.now(),
        details: { message: `Test finding ${i}` },
      })),
    };

    bench("JSON.stringify large object", () => {
      JSON.stringify(testData);
    });

    bench("JSON.parse large object", () => {
      const str = JSON.stringify(testData);
      JSON.parse(str);
    });
  });

  describe("Async Operations", () => {
    bench("Promise.all with 10 promises", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(i * 2),
      );
      await Promise.all(promises);
    });

    bench("Sequential awaits (10 operations)", async () => {
      for (let i = 0; i < 10; i++) {
        await Promise.resolve(i * 2);
      }
    });

    bench("setTimeout vs setImmediate", async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  describe("String Operations", () => {
    const longString = "test ".repeat(1000);

    bench("string concatenation with +", () => {
      let result = "";
      for (let i = 0; i < 100; i++) {
        result = result + "test";
      }
      return result;
    });

    bench("string concatenation with template literals", () => {
      let result = "";
      for (let i = 0; i < 100; i++) {
        result = `${result}test`;
      }
      return result;
    });

    bench("string concatenation with array join", () => {
      const parts: string[] = [];
      for (let i = 0; i < 100; i++) {
        parts.push("test");
      }
      return parts.join("");
    });

    bench("string splitting", () => {
      longString.split(" ");
    });
  });

  describe("Object Operations", () => {
    const obj = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`]),
    );

    bench("Object.keys iteration", () => {
      Object.keys(obj).forEach((_key) => {
        // Access value if needed: obj[key]
      });
    });

    bench("Object.entries iteration", () => {
      Object.entries(obj).forEach(([_key, _value]) => {
        // Process
      });
    });

    bench("for...in iteration", () => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // Access value if needed: obj[key];
        }
      }
    });
  });

  describe("Error Handling", () => {
    bench("try-catch with no error", () => {
      try {
        const result = Math.random() * 100;
        return result;
      } catch (error) {
        return 0;
      }
    });

    bench("try-catch with error thrown", () => {
      try {
        throw new Error("Test error");
      } catch (error) {
        return error;
      }
    });
  });

  describe("Type Checking", () => {
    const testValue: unknown = { test: "value" };

    bench("typeof check", () => {
      return typeof testValue === "object";
    });

    bench("instanceof check", () => {
      return testValue instanceof Object;
    });

    bench("Array.isArray check", () => {
      return Array.isArray(testValue);
    });
  });
});

/**
 * Performance targets (run with: vitest bench --reporter=verbose)
 *
 * Expected results (on modern hardware):
 * - Array iteration (10k items): < 1ms
 * - JSON operations (100 items): < 10ms
 * - Promise.all (10 promises): < 5ms
 * - String operations: < 5ms
 * - Object operations (1k keys): < 10ms
 *
 * To run these benchmarks:
 * pnpm test:bench
 *
 * To compare against baseline:
 * vitest bench --compare
 */
