/**
 * Circuit Breaker Pattern Implementation
 *
 * Provides fault tolerance by preventing cascading failures when external services are down.
 * Based on the Circuit Breaker pattern from Michael Nygard's "Release It!".
 *
 * ## States
 * - **CLOSED**: Normal operation, requests pass through, failures reset count
 * - **OPEN**: Circuit is tripped, requests fail fast without hitting service
 * - **HALF_OPEN**: Testing if service has recovered, limited requests allowed
 *
 * ## Configuration
 * - failureThreshold: Number of failures before opening circuit
 * - successThreshold: Number of successes in half-open to close circuit
 * - timeoutMs: How long to stay in open state before half-open
 * - halfOpenMaxCalls: Max calls allowed in half-open state
 */

import { createLogger } from "../logging/logger.js";

const logger = createLogger("CircuitBreaker");

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  /** Number of consecutive failures to open the circuit */
  failureThreshold: number;
  /** Number of consecutive successes to close the circuit */
  successThreshold: number;
  /** Time in milliseconds to stay open before attempting half-open */
  timeoutMs: number;
  /** Maximum calls allowed in half-open state */
  halfOpenMaxCalls: number;
  /** Optional name for logging */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
  rejectedRequests: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export interface CircuitBreakerOptions extends Partial<CircuitBreakerConfig> {
  name?: string;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000, // 1 minute
  halfOpenMaxCalls: 3,
  name: "circuit-breaker",
};

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    public readonly state: CircuitState,
    public readonly nextAttemptTime?: number,
    message?: string,
  ) {
    super(
      message ||
      `Circuit breaker is ${state}. Try again after ${nextAttemptTime ? new Date(nextAttemptTime).toISOString() : "unknown"}.`,
    );
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private openedAt?: number;
  private halfOpenCallCount = 0;
  private rejectedRequests = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private readonly config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG,
  ) {
    // Validate configuration
    if (config.failureThreshold <= 0) {
      throw new Error("failureThreshold must be greater than 0");
    }
    if (config.successThreshold <= 0) {
      throw new Error("successThreshold must be greater than 0");
    }
    if (config.timeoutMs <= 0) {
      throw new Error("timeoutMs must be greater than 0");
    }
    if (config.halfOpenMaxCalls <= 0) {
      throw new Error("halfOpenMaxCalls must be greater than 0");
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === "OPEN") {
      // Check if timeout has elapsed
      if (this.openedAt && Date.now() - this.openedAt >= this.config.timeoutMs) {
        this.transitionToHalfOpen();
      } else {
        this.rejectedRequests++;
        throw new CircuitBreakerError(
          this.state,
          this.openedAt ? this.openedAt + this.config.timeoutMs : undefined,
        );
      }
    }

    // Check if half-open limit reached
    if (this.state === "HALF_OPEN" && this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
      this.rejectedRequests++;
      throw new CircuitBreakerError(this.state);
    }

    if (this.state === "HALF_OPEN") {
      this.halfOpenCallCount++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;

    switch (this.state) {
      case "CLOSED":
        this.failureCount = 0;
        this.successCount = 0;
        break;
      case "HALF_OPEN":
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionToClosed();
        }
        break;
      case "OPEN":
        // Shouldn't happen, but handle gracefully
        this.transitionToClosed();
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    switch (this.state) {
      case "CLOSED":
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionToOpen();
        }
        break;
      case "HALF_OPEN":
        this.transitionToOpen();
        break;
      case "OPEN":
        // Already open, nothing to do
        break;
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    if (this.config.name) {
      logger.debug(`[${this.config.name}] Transitioning to CLOSED`);
    }
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.openedAt = undefined;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    if (this.config.name) {
      logger.warn(
        `[${this.config.name}] Transitioning to OPEN after ${this.failureCount} failures`,
      );
    }
    this.state = "OPEN";
    this.openedAt = Date.now();
    this.successCount = 0;
    this.halfOpenCallCount = 0;
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    if (this.config.name) {
      logger.debug(`[${this.config.name}] Transitioning to HALF_OPEN`);
    }
    this.state = "HALF_OPEN";
    this.successCount = 0;
    this.failureCount = 0;
    this.halfOpenCallCount = 0;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.openedAt ? this.openedAt + this.config.timeoutMs : undefined,
      rejectedRequests: this.rejectedRequests,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  reset(): void {
    if (this.config.name) {
      logger.debug(`[${this.config.name}] Manual reset to CLOSED`);
    }
    this.transitionToClosed();
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.rejectedRequests = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  /**
   * Force the circuit to open (useful for testing)
   */
  forceOpen(): void {
    if (this.config.name) {
      logger.debug(`[${this.config.name}] Forced to OPEN`);
    }
    this.transitionToOpen();
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers by name
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private breakers = new Map<string, CircuitBreaker>();

  private constructor() { }

  static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker by name
   */
  get(name: string, config?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker({
        ...DEFAULT_CIRCUIT_CONFIG,
        ...config,
        name,
      });
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    for (const [name, breaker] of this.breakers.entries()) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }
}

/**
 * Get the circuit breaker registry instance
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  return CircuitBreakerRegistry.getInstance();
}

/**
 * Create a circuit breaker with the given options
 */
export function createCircuitBreaker(
  options?: CircuitBreakerOptions,
): CircuitBreaker {
  return new CircuitBreaker({
    ...DEFAULT_CIRCUIT_CONFIG,
    ...options,
  });
}

/**
 * Execute a function with circuit breaker protection
 * Convenience function that gets or creates a breaker
 */
export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  config?: CircuitBreakerOptions,
): Promise<T> {
  const registry = getCircuitBreakerRegistry();
  const breaker = registry.get(name, config);
  return breaker.execute(fn);
}
