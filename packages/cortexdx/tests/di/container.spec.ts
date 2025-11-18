/**
 * DI Container Tests
 * Comprehensive test suite for dependency injection container
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  DIContainer,
  getContainer,
  resetContainer,
} from "../../src/di/container.js";

describe("DIContainer", () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe("Singleton Registration", () => {
    it("should register and retrieve a singleton", () => {
      let counter = 0;
      container.registerSingleton("counter", () => ++counter);

      const first = container.get<number>("counter");
      const second = container.get<number>("counter");

      expect(first).toBe(1);
      expect(second).toBe(1); // Same instance, counter only incremented once
    });

    it("should cache singleton instances", () => {
      const obj = { value: "test" };
      container.registerSingleton("obj", () => obj);

      const first = container.get<typeof obj>("obj");
      const second = container.get<typeof obj>("obj");

      expect(first).toBe(second); // Exact same reference
      expect(first).toBe(obj);
    });

    it("should allow overwriting a singleton registration", () => {
      container.registerSingleton("value", () => "first");
      container.registerSingleton("value", () => "second");

      const result = container.get<string>("value");
      expect(result).toBe("second");
    });
  });

  describe("Transient Registration", () => {
    it("should register and retrieve a transient dependency", () => {
      let counter = 0;
      container.registerTransient("counter", () => ++counter);

      const first = container.get<number>("counter");
      const second = container.get<number>("counter");
      const third = container.get<number>("counter");

      expect(first).toBe(1);
      expect(second).toBe(2); // New instance each time
      expect(third).toBe(3);
    });

    it("should NOT cache transient instances", () => {
      container.registerTransient("obj", () => ({ value: Math.random() }));

      const first = container.get<{ value: number }>("obj");
      const second = container.get<{ value: number }>("obj");

      expect(first).not.toBe(second); // Different references
      expect(first.value).not.toBe(second.value);
    });

    it("should create new instances for each transient call", () => {
      const instances: number[] = [];
      container.registerTransient("instance", () => {
        const id = Math.random();
        instances.push(id);
        return id;
      });

      container.get<number>("instance");
      container.get<number>("instance");
      container.get<number>("instance");

      expect(instances).toHaveLength(3);
      expect(new Set(instances).size).toBe(3); // All unique
    });

    it("should allow switching from singleton to transient", () => {
      let counter = 0;
      container.registerSingleton("counter", () => ++counter);

      const singleton1 = container.get<number>("counter");
      const singleton2 = container.get<number>("counter");

      expect(singleton1).toBe(1);
      expect(singleton2).toBe(1);

      // Switch to transient
      container.registerTransient("counter", () => ++counter);

      const transient1 = container.get<number>("counter");
      const transient2 = container.get<number>("counter");

      expect(transient1).toBe(2);
      expect(transient2).toBe(3); // New instance
    });
  });

  describe("Value Registration", () => {
    it("should register and retrieve a pre-instantiated value", () => {
      const value = { id: 123, name: "test" };
      container.registerValue("user", value);

      const retrieved = container.get<typeof value>("user");

      expect(retrieved).toBe(value);
      expect(retrieved.id).toBe(123);
    });

    it("should cache registered values", () => {
      const value = { data: "cached" };
      container.registerValue("cached", value);

      const first = container.get<typeof value>("cached");
      const second = container.get<typeof value>("cached");

      expect(first).toBe(second);
      expect(first).toBe(value);
    });
  });

  describe("Async Singleton Registration", () => {
    it("should register and retrieve an async singleton", async () => {
      let counter = 0;
      container.registerAsyncSingleton("async-counter", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return ++counter;
      });

      const first = await container.getAsync<number>("async-counter");
      const second = await container.getAsync<number>("async-counter");

      expect(first).toBe(1);
      expect(second).toBe(1); // Cached
    });

    it("should cache async singleton instances", async () => {
      const obj = { value: "async-test" };
      container.registerAsyncSingleton("async-obj", async () => obj);

      const first = await container.getAsync<typeof obj>("async-obj");
      const second = await container.getAsync<typeof obj>("async-obj");

      expect(first).toBe(second);
      expect(first).toBe(obj);
    });

    it("should deduplicate concurrent async singleton requests", async () => {
      let invocations = 0;
      container.registerAsyncSingleton("expensive", async () => {
        invocations++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return invocations;
      });

      const [first, second] = await Promise.all([
        container.getAsync<number>("expensive"),
        container.getAsync<number>("expensive"),
      ]);

      expect(first).toBe(1);
      expect(second).toBe(1);
      expect(invocations).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should throw error for unregistered dependency", () => {
      expect(() => container.get("not-registered")).toThrow(
        'Dependency "not-registered" not registered',
      );
    });

    it("should throw error for async dependency accessed synchronously", () => {
      container.registerAsyncSingleton("async", async () => "value");

      expect(() => container.get("async")).toThrow(
        'Dependency "async" is async. Use getAsync() instead.',
      );
    });

    it("should throw error for unregistered async dependency", async () => {
      await expect(container.getAsync("not-registered")).rejects.toThrow(
        'Dependency "not-registered" not registered',
      );
    });
  });

  describe("has() Method", () => {
    it("should return true for registered singleton", () => {
      container.registerSingleton("exists", () => "value");
      expect(container.has("exists")).toBe(true);
    });

    it("should return true for registered transient", () => {
      container.registerTransient("transient", () => "value");
      expect(container.has("transient")).toBe(true);
    });

    it("should return true for registered value", () => {
      container.registerValue("value", "test");
      expect(container.has("value")).toBe(true);
    });

    it("should return false for unregistered dependency", () => {
      expect(container.has("not-registered")).toBe(false);
    });

    it("should return true after instantiation", () => {
      container.registerSingleton("test", () => "value");
      container.get("test"); // Instantiate

      expect(container.has("test")).toBe(true);
    });
  });

  describe("remove() Method", () => {
    it("should remove a registered singleton", () => {
      container.registerSingleton("remove-me", () => "value");
      expect(container.has("remove-me")).toBe(true);

      container.remove("remove-me");
      expect(container.has("remove-me")).toBe(false);
    });

    it("should remove a transient dependency", () => {
      container.registerTransient("transient", () => "value");
      expect(container.has("transient")).toBe(true);

      container.remove("transient");
      expect(container.has("transient")).toBe(false);
    });

    it("should remove cached instances", () => {
      container.registerSingleton("cached", () => "value");
      container.get("cached"); // Cache it

      container.remove("cached");

      expect(() => container.get("cached")).toThrow();
    });
  });

  describe("clear() Method", () => {
    it("should clear all dependencies", () => {
      container.registerSingleton("singleton", () => "value1");
      container.registerTransient("transient", () => "value2");
      container.registerValue("value", "value3");

      expect(container.keys()).toHaveLength(3);

      container.clear();

      expect(container.keys()).toHaveLength(0);
      expect(container.has("singleton")).toBe(false);
      expect(container.has("transient")).toBe(false);
      expect(container.has("value")).toBe(false);
    });
  });

  describe("keys() Method", () => {
    it("should return all registered keys", () => {
      container.registerSingleton("key1", () => "value1");
      container.registerTransient("key2", () => "value2");
      container.registerValue("key3", "value3");

      const keys = container.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should not include removed keys", () => {
      container.registerSingleton("key1", () => "value1");
      container.registerSingleton("key2", () => "value2");

      container.remove("key1");

      const keys = container.keys();
      expect(keys).toHaveLength(1);
      expect(keys).toContain("key2");
      expect(keys).not.toContain("key1");
    });
  });

  describe("Global Container", () => {
    it("should return the same global container instance", () => {
      const first = getContainer();
      const second = getContainer();

      expect(first).toBe(second);
    });

    it("should share registrations across getContainer() calls", () => {
      const container1 = getContainer();
      container1.registerValue("shared", "value");

      const container2 = getContainer();
      const value = container2.get<string>("shared");

      expect(value).toBe("value");
    });

    it("should reset the global container", () => {
      const container1 = getContainer();
      container1.registerValue("before-reset", "value");

      resetContainer();

      const container2 = getContainer();
      expect(container2.has("before-reset")).toBe(false);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle dependency chains", () => {
      container.registerSingleton("config", () => ({ port: 3000 }));
      container.registerSingleton("server", () => {
        const config = container.get<{ port: number }>("config");
        return { port: config.port, status: "running" };
      });

      const server = container.get<{ port: number; status: string }>("server");

      expect(server.port).toBe(3000);
      expect(server.status).toBe("running");
    });

    it("should handle mixed singleton and transient dependencies", () => {
      let requestId = 0;
      container.registerSingleton("database", () => ({ connected: true }));
      container.registerTransient("request", () => ({ id: ++requestId }));

      const db1 = container.get<{ connected: boolean }>("database");
      const req1 = container.get<{ id: number }>("request");
      const db2 = container.get<{ connected: boolean }>("database");
      const req2 = container.get<{ id: number }>("request");

      expect(db1).toBe(db2); // Same singleton instance
      expect(req1.id).toBe(1);
      expect(req2.id).toBe(2); // Different transient instances
    });

    it("should handle async factory fallback", async () => {
      container.registerSingleton("async-as-sync", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return "async-value";
      });

      const value = await container.getAsync<string>("async-as-sync");
      expect(value).toBe("async-value");
    });
  });
});
