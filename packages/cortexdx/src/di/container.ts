/**
 * Dependency Injection Container
 * Simple, type-safe DI container for better testability and architecture
 */

type Factory<T> = () => T | Promise<T>;
type AsyncFactory<T> = () => Promise<T>;

/**
 * Dependency Injection Container
 * Provides singleton and transient dependency management
 */
export class DIContainer {
  private singletons = new Map<string, unknown>();
  private factories = new Map<string, Factory<unknown>>();
  private asyncFactories = new Map<string, AsyncFactory<unknown>>();

  /**
   * Register a singleton dependency
   * The factory will be called once and the result cached
   */
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory as Factory<unknown>);
  }

  /**
   * Register a transient dependency
   * The factory will be called every time get() is called
   */
  registerTransient<T>(key: string, factory: Factory<T>): void {
    this.factories.set(key, factory as Factory<unknown>);
    // Mark as transient by not caching in singletons
  }

  /**
   * Register an async singleton dependency
   */
  registerAsyncSingleton<T>(key: string, factory: AsyncFactory<T>): void {
    this.asyncFactories.set(key, factory as AsyncFactory<unknown>);
  }

  /**
   * Register an already-instantiated value
   */
  registerValue<T>(key: string, value: T): void {
    this.singletons.set(key, value);
  }

  /**
   * Get a dependency synchronously
   * Throws if dependency is not registered or is async
   */
  get<T>(key: string): T {
    // Check if already instantiated
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Get factory and instantiate
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependency "${key}" not registered`);
    }

    const instance = factory();
    if (instance instanceof Promise) {
      throw new Error(`Dependency "${key}" is async. Use getAsync() instead.`);
    }

    // Cache for singletons
    this.singletons.set(key, instance);
    return instance as T;
  }

  /**
   * Get a dependency asynchronously
   */
  async getAsync<T>(key: string): Promise<T> {
    // Check if already instantiated
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }

    // Try async factory first
    const asyncFactory = this.asyncFactories.get(key);
    if (asyncFactory) {
      const instance = await asyncFactory();
      this.singletons.set(key, instance);
      return instance as T;
    }

    // Fall back to sync factory
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Dependency "${key}" not registered`);
    }

    const result = factory();
    const instance = result instanceof Promise ? await result : result;
    this.singletons.set(key, instance);
    return instance as T;
  }

  /**
   * Check if a dependency is registered
   */
  has(key: string): boolean {
    return (
      this.singletons.has(key) ||
      this.factories.has(key) ||
      this.asyncFactories.has(key)
    );
  }

  /**
   * Remove a dependency
   */
  remove(key: string): void {
    this.singletons.delete(key);
    this.factories.delete(key);
    this.asyncFactories.delete(key);
  }

  /**
   * Clear all dependencies
   */
  clear(): void {
    this.singletons.clear();
    this.factories.clear();
    this.asyncFactories.clear();
  }

  /**
   * Get all registered keys
   */
  keys(): string[] {
    const allKeys = new Set([
      ...this.singletons.keys(),
      ...this.factories.keys(),
      ...this.asyncFactories.keys(),
    ]);
    return Array.from(allKeys);
  }
}

/**
 * Global container instance
 */
let globalContainer: DIContainer | null = null;

/**
 * Get the global DI container
 */
export function getContainer(): DIContainer {
  if (!globalContainer) {
    globalContainer = new DIContainer();
  }
  return globalContainer;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
  globalContainer = new DIContainer();
}

/**
 * Example usage:
 *
 * ```typescript
 * import { getContainer } from './di/container';
 *
 * // Setup
 * const container = getContainer();
 *
 * // Register dependencies
 * container.registerSingleton('logger', () => createLogger());
 * container.registerSingleton('database', () => new Database(DB_PATH));
 * container.registerSingleton('cache', () => new LRUCache({ maxSize: 1000 }));
 *
 * // Use dependencies
 * const logger = container.get<Logger>('logger');
 * const db = container.get<Database>('database');
 *
 * // Async dependencies
 * container.registerAsyncSingleton('config', async () => {
 *   const data = await loadConfig();
 *   return new Config(data);
 * });
 *
 * const config = await container.getAsync<Config>('config');
 * ```
 */
