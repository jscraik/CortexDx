/**
 * Circuit Breaker Tests
 *
 * Tests for the circuit breaker pattern implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  createCircuitBreaker,
  getCircuitBreakerRegistry,
  withCircuitBreaker,
  DEFAULT_CIRCUIT_CONFIG,
  type CircuitState,
  type CircuitBreakerConfig,
} from "../src/resilience/circuit-breaker.js";

describe("circuit-breaker", () => {
  describe("CircuitBreaker", () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 100,
        halfOpenMaxCalls: 2,
        name: "test-breaker",
      });
    });

    describe("initial state", () => {
      it("should start in CLOSED state", () => {
        expect(breaker.getState()).toBe("CLOSED");
      });

      it("should have zero counts", () => {
        const stats = breaker.getStats();
        expect(stats.failureCount).toBe(0);
        expect(stats.successCount).toBe(0);
        expect(stats.totalRequests).toBe(0);
        expect(stats.totalFailures).toBe(0);
        expect(stats.totalSuccesses).toBe(0);
        expect(stats.rejectedRequests).toBe(0);
      });
    });

    describe("CLOSED state", () => {
      it("should allow requests when CLOSED", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        const result = await breaker.execute(fn);

        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("should track successes in CLOSED state", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        await breaker.execute(fn);
        await breaker.execute(fn);

        const stats = breaker.getStats();
        expect(stats.totalSuccesses).toBe(2);
        expect(stats.totalRequests).toBe(2);
      });

      it("should track failures in CLOSED state", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("failure"));
        await expect(breaker.execute(fn)).rejects.toThrow("failure");

        const stats = breaker.getStats();
        expect(stats.failureCount).toBe(1);
        expect(stats.totalFailures).toBe(1);
      });

      it("should reset failure count on success", async () => {
        const failFn = vi.fn().mockRejectedValue(new Error("failure"));
        const successFn = vi.fn().mockResolvedValue("success");

        // Fail twice
        await expect(breaker.execute(failFn)).rejects.toThrow();
        await expect(breaker.execute(failFn)).rejects.toThrow();

        expect(breaker.getStats().failureCount).toBe(2);

        // Succeed once
        await breaker.execute(successFn);

        expect(breaker.getStats().failureCount).toBe(0);
      });

      it("should open circuit after failure threshold", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("failure"));

        // Fail 3 times (threshold)
        await expect(breaker.execute(fn)).rejects.toThrow();
        await expect(breaker.execute(fn)).rejects.toThrow();
        await expect(breaker.execute(fn)).rejects.toThrow();

        expect(breaker.getState()).toBe("OPEN");
      });
    });

    describe("OPEN state", () => {
      beforeEach(async () => {
        // Open the circuit
        const fn = vi.fn().mockRejectedValue(new Error("failure"));
        await expect(breaker.execute(fn)).rejects.toThrow();
        await expect(breaker.execute(fn)).rejects.toThrow();
        await expect(breaker.execute(fn)).rejects.toThrow();
        expect(breaker.getState()).toBe("OPEN");
      });

      it("should reject requests when OPEN", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerError);
        expect(fn).not.toHaveBeenCalled();
      });

      it("should increment rejected request count", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        await expect(breaker.execute(fn)).rejects.toThrow();
        await expect(breaker.execute(fn)).rejects.toThrow();

        const stats = breaker.getStats();
        expect(stats.rejectedRequests).toBe(2);
      });

      it("should provide next attempt time", async () => {
        const fn = vi.fn().mockResolvedValue("success");
        try {
          await breaker.execute(fn);
        } catch (error) {
          expect(error).toBeInstanceOf(CircuitBreakerError);
          const cbError = error as CircuitBreakerError;
          expect(cbError.nextAttemptTime).toBeDefined();
          expect(cbError.nextAttemptTime).toBeGreaterThan(Date.now());
        }
      });

      it("should transition to HALF_OPEN after timeout", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        // Wait for timeout (100ms)
        await new Promise((resolve) => setTimeout(resolve, 110));

        // Next request should transition to HALF_OPEN and execute
        const result = await breaker.execute(fn);

        expect(result).toBe("success");
        expect(breaker.getState()).toBe("HALF_OPEN");
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });

    describe("HALF_OPEN state", () => {
      beforeEach(async () => {
        // Open the circuit
        const failFn = vi.fn().mockRejectedValue(new Error("failure"));
        await expect(breaker.execute(failFn)).rejects.toThrow();
        await expect(breaker.execute(failFn)).rejects.toThrow();
        await expect(breaker.execute(failFn)).rejects.toThrow();

        // Wait for timeout
        await new Promise((resolve) => setTimeout(resolve, 110));

        // First request transitions to HALF_OPEN
        const successFn = vi.fn().mockResolvedValue("success");
        await breaker.execute(successFn);
        expect(breaker.getState()).toBe("HALF_OPEN");
      });

      it("should close circuit after success threshold", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        // First success (from beforeEach) + one more = threshold reached
        await breaker.execute(fn);

        expect(breaker.getState()).toBe("CLOSED");
      });

      it("should open circuit on failure in HALF_OPEN", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("failure"));

        await expect(breaker.execute(fn)).rejects.toThrow();

        expect(breaker.getState()).toBe("OPEN");
      });

      it("should close after reaching success threshold in HALF_OPEN", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        // We've made 1 call in beforeEach (successCount = 1, but with a different spy)
        // This second success will reach the threshold (2) and close the circuit
        await breaker.execute(fn);

        // Circuit should now be CLOSED and successCount reset
        expect(breaker.getState()).toBe("CLOSED");
        expect(breaker.getStats().successCount).toBe(0);

        // Subsequent calls should work normally in CLOSED state
        await breaker.execute(fn);
        expect(fn).toHaveBeenCalledTimes(2); // fn was called twice in this test
      });
    });

    describe("reset", () => {
      it("should reset to CLOSED state", async () => {
        // Open the circuit
        const failFn = vi.fn().mockRejectedValue(new Error("failure"));
        await expect(breaker.execute(failFn)).rejects.toThrow();
        await expect(breaker.execute(failFn)).rejects.toThrow();
        await expect(breaker.execute(failFn)).rejects.toThrow();

        expect(breaker.getState()).toBe("OPEN");

        // Reset
        breaker.reset();

        expect(breaker.getState()).toBe("CLOSED");
        expect(breaker.getStats().failureCount).toBe(0);
        expect(breaker.getStats().rejectedRequests).toBe(0);
      });
    });

    describe("forceOpen", () => {
      it("should force circuit to OPEN state", () => {
        expect(breaker.getState()).toBe("CLOSED");

        breaker.forceOpen();

        expect(breaker.getState()).toBe("OPEN");
      });
    });
  });

  describe("CircuitBreakerRegistry", () => {
    let registry: CircuitBreakerRegistry;

    beforeEach(() => {
      registry = new CircuitBreakerRegistry();
    });

    describe("get", () => {
      it("should create new breaker if not exists", () => {
        const breaker = registry.get("new-breaker");
        expect(breaker).toBeInstanceOf(CircuitBreaker);
        expect(breaker.getState()).toBe("CLOSED");
      });

      it("should reuse existing breaker", () => {
        const breaker1 = registry.get("shared-breaker");
        const breaker2 = registry.get("shared-breaker");
        expect(breaker1).toBe(breaker2);
      });

      it("should apply custom config", () => {
        const breaker = registry.get("custom-breaker", {
          failureThreshold: 10,
          timeoutMs: 5000,
        });

        // Can't directly access config, but we can test behavior
        // For now just verify it was created
        expect(breaker).toBeInstanceOf(CircuitBreaker);
      });
    });

    describe("getAll", () => {
      it("should return all breakers", () => {
        registry.get("breaker1");
        registry.get("breaker2");
        registry.get("breaker3");

        const all = registry.getAll();
        expect(all.size).toBe(3);
        expect(all.has("breaker1")).toBe(true);
        expect(all.has("breaker2")).toBe(true);
        expect(all.has("breaker3")).toBe(true);
      });
    });

    describe("getAllStats", () => {
      it("should return stats for all breakers", async () => {
        const breaker1 = registry.get("breaker1");
        const breaker2 = registry.get("breaker2");

        // Execute some requests
        const fn = vi.fn().mockResolvedValue("success");
        await breaker1.execute(fn);

        const stats = registry.getAllStats();
        expect(stats.size).toBe(2);
        expect(stats.get("breaker1")?.totalRequests).toBe(1);
        expect(stats.get("breaker2")?.totalRequests).toBe(0);
      });
    });

    describe("remove", () => {
      it("should remove a breaker", () => {
        registry.get("breaker1");
        expect(registry.getAll().size).toBe(1);

        const removed = registry.remove("breaker1");
        expect(removed).toBe(true);
        expect(registry.getAll().size).toBe(0);
      });

      it("should return false for non-existent breaker", () => {
        const removed = registry.remove("non-existent");
        expect(removed).toBe(false);
      });
    });

    describe("resetAll", () => {
      it("should reset all breakers", async () => {
        const breaker1 = registry.get("breaker1", { failureThreshold: 2 });
        const breaker2 = registry.get("breaker2", { failureThreshold: 2 });

        // Open both circuits
        const failFn = vi.fn().mockRejectedValue(new Error("failure"));
        await expect(breaker1.execute(failFn)).rejects.toThrow();
        await expect(breaker1.execute(failFn)).rejects.toThrow();
        await expect(breaker2.execute(failFn)).rejects.toThrow();
        await expect(breaker2.execute(failFn)).rejects.toThrow();

        expect(breaker1.getState()).toBe("OPEN");
        expect(breaker2.getState()).toBe("OPEN");

        // Reset all
        registry.resetAll();

        expect(breaker1.getState()).toBe("CLOSED");
        expect(breaker2.getState()).toBe("CLOSED");
      });
    });
  });

  describe("singleton", () => {
    it("should return the same instance", () => {
      const instance1 = getCircuitBreakerRegistry();
      const instance2 = getCircuitBreakerRegistry();
      expect(instance1).toBe(instance2);
    });
  });

  describe("createCircuitBreaker", () => {
    it("should create a new circuit breaker", () => {
      const breaker = createCircuitBreaker({
        name: "test-breaker",
      });

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should merge config with defaults", async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 10,
        name: "test",
      });

      // Verify by behavior (opening after 10 failures)
      const failFn = vi.fn().mockRejectedValue(new Error("failure"));

      for (let i = 0; i < 9; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow();
      }

      expect(breaker.getState()).toBe("CLOSED");

      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("withCircuitBreaker", () => {
    it("should execute function with breaker", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const result = await withCircuitBreaker("test-breaker", fn);

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should reuse breaker for same name", async () => {
      const fn = vi.fn().mockResolvedValue("result");

      await withCircuitBreaker("shared", fn);
      await withCircuitBreaker("shared", fn);

      const registry = getCircuitBreakerRegistry();
      const breaker = registry.get("shared");
      expect(breaker.getStats().totalRequests).toBe(2);
    });

    it("should apply custom config", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("failure"));

      // With failure threshold of 2, should open after 2 failures
      await expect(
        withCircuitBreaker("custom", fn, { failureThreshold: 2 }),
      ).rejects.toThrow();
      await expect(
        withCircuitBreaker("custom", fn, { failureThreshold: 2 }),
      ).rejects.toThrow();

      const registry = getCircuitBreakerRegistry();
      const breaker = registry.get("custom");
      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("configuration validation", () => {
    it("should reject invalid failureThreshold", () => {
      expect(() => {
        new CircuitBreaker({
          ...DEFAULT_CIRCUIT_CONFIG,
          failureThreshold: 0,
        });
      }).toThrow("failureThreshold must be greater than 0");
    });

    it("should reject invalid successThreshold", () => {
      expect(() => {
        new CircuitBreaker({
          ...DEFAULT_CIRCUIT_CONFIG,
          successThreshold: 0,
        });
      }).toThrow("successThreshold must be greater than 0");
    });

    it("should reject invalid timeoutMs", () => {
      expect(() => {
        new CircuitBreaker({
          ...DEFAULT_CIRCUIT_CONFIG,
          timeoutMs: -1,
        });
      }).toThrow("timeoutMs must be greater than 0");
    });

    it("should reject invalid halfOpenMaxCalls", () => {
      expect(() => {
        new CircuitBreaker({
          ...DEFAULT_CIRCUIT_CONFIG,
          halfOpenMaxCalls: 0,
        });
      }).toThrow("halfOpenMaxCalls must be greater than 0");
    });
  });

  describe("CircuitBreakerError", () => {
    it("should include state in error", () => {
      const error = new CircuitBreakerError("OPEN");
      expect(error.state).toBe("OPEN");
      expect(error.name).toBe("CircuitBreakerError");
    });

    it("should include nextAttemptTime", () => {
      const nextAttempt = Date.now() + 60000;
      const error = new CircuitBreakerError("OPEN", nextAttempt);
      expect(error.nextAttemptTime).toBe(nextAttempt);
    });

    it("should generate default message", () => {
      const nextAttempt = Date.now() + 60000;
      const error = new CircuitBreakerError("OPEN", nextAttempt);
      expect(error.message).toContain("OPEN");
      expect(error.message).toContain("Try again after");
    });

    it("should accept custom message", () => {
      const error = new CircuitBreakerError("OPEN", undefined, "Custom message");
      expect(error.message).toBe("Custom message");
    });
  });

  describe("integration scenarios", () => {
    it("should handle service recovery scenario", async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 50,
        halfOpenMaxCalls: 3,
        name: "recovery-test",
      });

      const failFn = vi.fn().mockRejectedValue(new Error("Service unavailable"));
      const successFn = vi.fn().mockResolvedValue("success");

      // Service is down - fail 3 times
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe("OPEN");

      // Requests should be rejected
      await expect(breaker.execute(successFn)).rejects.toThrow(CircuitBreakerError);
      expect(successFn).not.toHaveBeenCalled();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Service recovers - first success in HALF_OPEN
      const result1 = await breaker.execute(successFn);
      expect(result1).toBe("success");
      expect(breaker.getState()).toBe("HALF_OPEN");

      // Second success closes circuit
      const result2 = await breaker.execute(successFn);
      expect(result2).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");

      // Normal operation resumes
      const result3 = await breaker.execute(successFn);
      expect(result3).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should handle flapping service scenario", async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        timeoutMs: 50,
        halfOpenMaxCalls: 2,
        name: "flapping-test",
      });

      let callCount = 0;
      const flappingFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 0) {
          return "success";
        }
        throw new Error("Intermittent failure");
      });

      // Alternating success/failure should keep circuit closed
      // (failures don't reach threshold)
      await expect(breaker.execute(flappingFn)).rejects.toThrow();
      const r1 = await breaker.execute(flappingFn);
      expect(r1).toBe("success");
      await expect(breaker.execute(flappingFn)).rejects.toThrow();
      const r2 = await breaker.execute(flappingFn);
      expect(r2).toBe("success");

      expect(breaker.getState()).toBe("CLOSED");
    });
  });
});
