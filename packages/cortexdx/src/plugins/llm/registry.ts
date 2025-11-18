/**
 * LLM Plugin Registry
 * Manages multiple LLM provider plugins with automatic fallback and resolution
 */

import { createRequire } from "node:module";
import { secureLogger } from "../../utils/security/secure-logger.js";
import type { SecureLogger } from "../../utils/security/secure-logger.js";
import type {
  LLMGenerateRequest,
  LLMPluginContext,
  LLMProviderMetadata,
  LLMProviderPlugin,
  ProviderResponse,
} from "./types.js";

export interface LLMRegistryOptions {
  env?: NodeJS.ProcessEnv;
  defaults?: LLMPluginContext["defaults"];
  logger?: SecureLogger;
  plugins?: LLMProviderPlugin[];
}

const requireFromRegistry = createRequire(import.meta.url);
let cachedExternalPlugins: LLMProviderPlugin[] | null = null;

function isPluginCandidate(candidate: unknown): candidate is LLMProviderPlugin {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const plugin = candidate as Partial<LLMProviderPlugin>;
  return (
    typeof plugin.metadata?.id === "string" &&
    typeof plugin.supports === "function" &&
    typeof plugin.generate === "function"
  );
}

function loadExternalPluginsFromEnv(
  logger: SecureLogger
): LLMProviderPlugin[] {
  if (cachedExternalPlugins) {
    return cachedExternalPlugins;
  }

  const moduleList = process.env.LLM_PLUGIN_MODULES?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!moduleList || moduleList.length === 0) {
    cachedExternalPlugins = [];
    return cachedExternalPlugins;
  }

  const plugins: LLMProviderPlugin[] = [];

  for (const specifier of moduleList) {
    try {
      const loaded = requireFromRegistry(specifier);
      const pluginExport = loaded?.default ?? loaded?.plugin ?? loaded;
      if (isPluginCandidate(pluginExport)) {
        plugins.push(pluginExport);
        logger.info("LLMPluginRegistry", "Registered external plugin", {
          id: pluginExport.metadata.id,
        });
      } else {
        logger.warn(
          "LLMPluginRegistry",
          "External plugin module did not export a valid plugin",
          { specifier }
        );
      }
    } catch (error) {
      logger.error(
        "LLMPluginRegistry",
        "Failed to load external plugin module",
        error instanceof Error ? error : undefined,
        { specifier }
      );
    }
  }

  cachedExternalPlugins = plugins;
  return plugins;
}

export class LLMPluginRegistry {
  private readonly plugins = new Map<string, LLMProviderPlugin>();
  private readonly initialized = new Set<string>();
  private readonly env: NodeJS.ProcessEnv;
  private readonly defaults: LLMPluginContext["defaults"];
  private readonly logger: SecureLogger;

  constructor(options: LLMRegistryOptions = {}) {
    this.env = options.env ?? process.env;
    const envDefaultModel =
      typeof this.env.DEFAULT_MODEL === "string"
        ? this.env.DEFAULT_MODEL
        : undefined;
    this.defaults =
      options.defaults ?? (envDefaultModel ? { model: envDefaultModel } : undefined);
    this.logger = options.logger ?? secureLogger;

    const initialPlugins = options.plugins ?? [];
    for (const plugin of initialPlugins) {
      this.register(plugin);
    }
  }

  private createContext(): LLMPluginContext {
    const context: LLMPluginContext = {
      env: this.env,
      logger: this.logger,
    };
    if (this.defaults) {
      context.defaults = this.defaults;
    }
    return context;
  }

  register(plugin: LLMProviderPlugin): void {
    this.plugins.set(plugin.metadata.id, plugin);
    this.logger.debug("LLMPluginRegistry", "Plugin registered", {
      id: plugin.metadata.id,
      displayName: plugin.metadata.displayName,
    });
  }

  async ensurePlugin(
    providerId: string
  ): Promise<{ plugin: LLMProviderPlugin; context: LLMPluginContext } | null> {
    const context = this.createContext();
    const plugin = this.getPlugin(providerId);
    if (!plugin) {
      return null;
    }

    try {
      if (!plugin.supports(context)) {
        return null;
      }
    } catch (error) {
      this.logger.warn(
        "LLMPluginRegistry",
        `Plugin ${plugin.metadata.id} support check failed during ensure`,
        {
          error: error instanceof Error ? error.message : "Unknown error",
        }
      );
      return null;
    }

    await this.ensureInitialized(plugin, context);
    return { plugin, context };
  }

  getMetadata(): LLMProviderMetadata[] {
    return Array.from(this.plugins.values()).map((plugin) => plugin.metadata);
  }

  private async ensureInitialized(
    plugin: LLMProviderPlugin,
    context: LLMPluginContext
  ): Promise<void> {
    if (this.initialized.has(plugin.metadata.id)) {
      return;
    }

    try {
      await plugin.initialize?.(context);
      this.initialized.add(plugin.metadata.id);
      this.logger.info("LLMPluginRegistry", "Plugin initialized", {
        id: plugin.metadata.id,
      });
    } catch (error) {
      this.logger.error(
        "LLMPluginRegistry",
        `Failed to initialize plugin ${plugin.metadata.id}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  getAvailable(
    context: LLMPluginContext = this.createContext()
  ): LLMProviderPlugin[] {
    const available: LLMProviderPlugin[] = [];
    for (const plugin of this.plugins.values()) {
      try {
        if (plugin.supports(context)) {
          available.push(plugin);
        }
      } catch (error) {
        this.logger.warn(
          "LLMPluginRegistry",
          `Plugin ${plugin.metadata.id} support check failed`,
          {
            error: error instanceof Error ? error.message : "Unknown error",
          }
        );
      }
    }
    return available;
  }

  async initializeAll(): Promise<void> {
    const context = this.createContext();
    const available = this.getAvailable(context);
    await Promise.all(
      available.map((plugin) => this.ensureInitialized(plugin, context))
    );
  }

  getPlugin(id: string): LLMProviderPlugin | undefined {
    return this.plugins.get(id);
  }

  async resolve(
    providerId?: string
  ): Promise<{ plugin: LLMProviderPlugin; context: LLMPluginContext } | null> {
    const context = this.createContext();

    if (providerId) {
      const plugin = this.getPlugin(providerId);
      let supports = false;
      if (plugin) {
        try {
          supports = plugin.supports(context);
        } catch (err) {
          this.logger.warn(
            "LLMPluginRegistry",
            "Error in plugin.supports; falling back",
            {
              providerId,
              error: err,
            }
          );
        }
      }
      if (plugin && supports) {
        await this.ensureInitialized(plugin, context);
        return { plugin, context };
      }
      this.logger.warn(
        "LLMPluginRegistry",
        "Requested plugin unavailable; falling back",
        { providerId }
      );
    }

    const available = this.getAvailable(context);
    if (available.length === 0) {
      return null;
    }

    const fallback = available[0];
    await this.ensureInitialized(fallback, context);
    return { plugin: fallback, context };
  }

  async generate(
    request: LLMGenerateRequest,
    providerId?: string
  ): Promise<{ response: ProviderResponse; plugin: LLMProviderPlugin }> {
    const resolved = await this.resolve(providerId);
    if (!resolved) {
      const availableMetadata = this.getMetadata();
      this.logger.error("LLMPluginRegistry", "No available LLM providers", undefined, {
        availablePlugins: availableMetadata,
      });
      throw new Error(
        "No available LLM provider plugins match the current configuration."
      );
    }

    const { plugin, context } = resolved;
    const response = await plugin.generate(request, context);
    return { response, plugin };
  }
}

let sharedRegistry: LLMPluginRegistry | null = null;

export function getLLMRegistry(
  options: LLMRegistryOptions = {}
): LLMPluginRegistry {
  if (options.plugins || options.env || options.logger || options.defaults) {
    return new LLMPluginRegistry(options);
  }

  if (!sharedRegistry) {
    const externalPlugins = loadExternalPluginsFromEnv(secureLogger);
    sharedRegistry = new LLMPluginRegistry({
      plugins: [...externalPlugins],
    });
  }

  return sharedRegistry;
}

export function resetLLMRegistry(): void {
  sharedRegistry = null;
  cachedExternalPlugins = null;
}
