/**
 * Plugin Registry
 * Manages server plugin lifecycle and hook execution
 */

import { createLogger } from '../../logging/logger';
import type { ServerPlugin, ServerPluginHost, RequestContext, HookResult } from './types';
import type { JsonRpcResponse } from '../transports/types';

const logger = createLogger({ component: 'plugin-registry' });

export class PluginRegistry {
  private plugins: Map<string, ServerPlugin> = new Map();

  /**
   * Register a plugin
   */
  register(plugin: ServerPlugin): void {
    if (this.plugins.has(plugin.name)) {
      logger.warn({ plugin: plugin.name }, 'Plugin already registered, replacing');
    }
    this.plugins.set(plugin.name, plugin);
    logger.debug({ plugin: plugin.name, version: plugin.version }, 'Plugin registered');
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    const removed = this.plugins.delete(name);
    if (removed) {
      logger.debug({ plugin: name }, 'Plugin unregistered');
    }
    return removed;
  }

  /**
   * Get a plugin by name
   */
  get(name: string): ServerPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get all plugins sorted by priority
   */
  getAll(): ServerPlugin[] {
    return Array.from(this.plugins.values()).sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );
  }

  /**
   * Get plugin count
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    logger.debug('All plugins cleared');
  }

  /**
   * Initialize all plugins
   */
  async initializeAll(host: ServerPluginHost): Promise<void> {
    for (const plugin of this.getAll()) {
      if (plugin.onLoad) {
        try {
          await plugin.onLoad(host);
          logger.debug({ plugin: plugin.name }, 'Plugin initialized');
        } catch (error) {
          logger.error({ plugin: plugin.name, error }, 'Plugin initialization failed');
          throw error;
        }
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanupAll(host: ServerPluginHost): Promise<void> {
    // Cleanup in reverse order
    const plugins = this.getAll().reverse();
    for (const plugin of plugins) {
      if (plugin.onUnload) {
        try {
          await plugin.onUnload(host);
          logger.debug({ plugin: plugin.name }, 'Plugin cleaned up');
        } catch (error) {
          logger.error({ plugin: plugin.name, error }, 'Plugin cleanup failed');
        }
      }
    }
  }

  /**
   * Run onRequest hook across all plugins
   * Returns early if any plugin returns a response
   */
  async runOnRequest(ctx: RequestContext): Promise<JsonRpcResponse | undefined> {
    for (const plugin of this.getAll()) {
      if (plugin.onRequest) {
        try {
          const result = await plugin.onRequest(ctx);
          if (result !== undefined && result !== null) {
            return result as JsonRpcResponse;
          }
        } catch (error) {
          logger.error({ plugin: plugin.name, error }, 'onRequest hook error');
          throw error;
        }
      }
    }
    return undefined;
  }

  /**
   * Run onResponse hook across all plugins
   * Allows plugins to transform the response
   */
  async runOnResponse(
    ctx: RequestContext,
    response: JsonRpcResponse
  ): Promise<JsonRpcResponse> {
    let result = response;
    for (const plugin of this.getAll()) {
      if (plugin.onResponse) {
        try {
          result = await plugin.onResponse(ctx, result);
        } catch (error) {
          logger.error({ plugin: plugin.name, error }, 'onResponse hook error');
        }
      }
    }
    return result;
  }

  /**
   * Run onError hook across all plugins
   * First plugin to return a response wins
   */
  async runOnError(
    ctx: RequestContext,
    error: Error
  ): Promise<JsonRpcResponse | undefined> {
    for (const plugin of this.getAll()) {
      if (plugin.onError) {
        try {
          const result = await plugin.onError(ctx, error);
          if (result !== undefined) {
            return result;
          }
        } catch (hookError) {
          logger.error({ plugin: plugin.name, hookError }, 'onError hook error');
        }
      }
    }
    return undefined;
  }

  /**
   * Run onToolCall hook across all plugins
   */
  async runOnToolCall(
    ctx: RequestContext,
    toolName: string,
    args: unknown
  ): Promise<void> {
    for (const plugin of this.getAll()) {
      if (plugin.onToolCall) {
        try {
          await plugin.onToolCall(ctx, toolName, args);
        } catch (error) {
          logger.error({ plugin: plugin.name, toolName, error }, 'onToolCall hook error');
          throw error;
        }
      }
    }
  }

  /**
   * Run onToolResult hook across all plugins
   * Allows plugins to transform the result
   */
  async runOnToolResult(
    ctx: RequestContext,
    toolName: string,
    result: unknown
  ): Promise<unknown> {
    let transformed = result;
    for (const plugin of this.getAll()) {
      if (plugin.onToolResult) {
        try {
          const newResult = await plugin.onToolResult(ctx, toolName, transformed);
          if (newResult !== undefined) {
            transformed = newResult;
          }
        } catch (error) {
          logger.error({ plugin: plugin.name, toolName, error }, 'onToolResult hook error');
        }
      }
    }
    return transformed;
  }

  /**
   * Run onResourceRead hook across all plugins
   */
  async runOnResourceRead(ctx: RequestContext, uri: string): Promise<void> {
    for (const plugin of this.getAll()) {
      if (plugin.onResourceRead) {
        try {
          await plugin.onResourceRead(ctx, uri);
        } catch (error) {
          logger.error({ plugin: plugin.name, uri, error }, 'onResourceRead hook error');
          throw error;
        }
      }
    }
  }
}
