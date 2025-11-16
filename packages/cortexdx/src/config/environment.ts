/**
 * Centralized Environment Variable Manager
 * Provides type-safe access to environment variables with validation
 */

import { z } from 'zod';

/**
 * Environment variable schema
 * Defines all environment variables used across the application
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(5001),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // TLS Configuration
  CORTEXDX_TLS_CERT_PATH: z.string().optional(),
  CORTEXDX_TLS_KEY_PATH: z.string().optional(),

  // Authentication
  CORTEXDX_ADMIN_TOKEN: z.string().optional(),
  CORTEXDX_AUTH0_CLIENT_SECRET: z.string().optional(),
  CORTEXDX_AUTH0_CLIENT_ID: z.string().optional(),
  CORTEXDX_AUTH0_DOMAIN: z.string().optional(),
  CORTEXDX_AUTH0_AUDIENCE: z.string().optional(),

  // API Keys
  CONTEXT7_API_KEY: z.string().optional(),
  SEMANTIC_SCHOLAR_API_KEY: z.string().optional(),
  OPENALEX_API_KEY: z.string().optional(),
  WIKIDATA_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),

  // Feature Flags
  ENABLE_MONITORING: z.coerce.boolean().default(false),
  ENABLE_AUTO_HEALING: z.coerce.boolean().default(false),
  CORTEXDX_RUN_INTEGRATION: z.coerce.boolean().default(false),

  // Test Environment
  VITEST: z.string().optional(),

  // AWS Configuration
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // Monitoring
  MONITORING_INTERVAL_MS: z.coerce.number().default(60000),

  // DeepContext
  DEEPCONTEXT_API_URL: z.string().optional(),
  DEEPCONTEXT_API_KEY: z.string().optional(),

  // LLM Configuration
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Debug
  DEBUG: z.string().optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

/**
 * Parsed and validated environment variables
 */
export type Environment = z.infer<typeof envSchema>;

/**
 * Environment variable manager class
 */
class EnvironmentManager {
  private config: Environment;
  private isValidated = false;

  constructor() {
    // Parse and validate environment variables
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('Environment variable validation failed:');
      console.error(result.error.format());
      throw new Error('Invalid environment configuration');
    }

    this.config = result.data;
    this.isValidated = true;
  }

  /**
   * Get a specific environment variable
   */
  get<K extends keyof Environment>(key: K): Environment[K] {
    if (!this.isValidated) {
      throw new Error('Environment not validated');
    }
    return this.config[key];
  }

  /**
   * Get all environment variables
   */
  getAll(): Readonly<Environment> {
    if (!this.isValidated) {
      throw new Error('Environment not validated');
    }
    return Object.freeze({ ...this.config });
  }

  /**
   * Check if a specific variable is set
   */
  has(key: keyof Environment): boolean {
    return this.config[key] !== undefined && this.config[key] !== '';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.config.NODE_ENV === 'test' || this.config.VITEST === 'true';
  }

  /**
   * Check if TLS is enabled
   */
  isTlsEnabled(): boolean {
    return Boolean(
      this.config.CORTEXDX_TLS_CERT_PATH &&
      this.config.CORTEXDX_TLS_KEY_PATH
    );
  }

  /**
   * Get API key for a specific service
   */
  getApiKey(service: 'context7' | 'semantic_scholar' | 'openalex' | 'wikidata' | 'exa' | 'openai' | 'anthropic' | 'deepcontext'): string | undefined {
    switch (service) {
      case 'context7':
        return this.config.CONTEXT7_API_KEY;
      case 'semantic_scholar':
        return this.config.SEMANTIC_SCHOLAR_API_KEY;
      case 'openalex':
        return this.config.OPENALEX_API_KEY;
      case 'wikidata':
        return this.config.WIKIDATA_API_KEY;
      case 'exa':
        return this.config.EXA_API_KEY;
      case 'openai':
        return this.config.OPENAI_API_KEY;
      case 'anthropic':
        return this.config.ANTHROPIC_API_KEY;
      case 'deepcontext':
        return this.config.DEEPCONTEXT_API_KEY;
      default:
        return undefined;
    }
  }

  /**
   * Validate that required API keys are present for enabled features
   */
  validateRequiredKeys(requiredServices: Array<'context7' | 'semantic_scholar' | 'openalex' | 'wikidata' | 'exa' | 'openai' | 'anthropic' | 'deepcontext'>): void {
    const missing: string[] = [];

    for (const service of requiredServices) {
      if (!this.getApiKey(service)) {
        missing.push(service);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required API keys: ${missing.join(', ')}`);
    }
  }

  /**
   * Get masked value for logging (shows only first/last 4 chars)
   */
  getMasked(key: keyof Environment): string {
    const value = this.config[key];
    if (!value || typeof value !== 'string') {
      return 'undefined';
    }
    if (value.length <= 8) {
      return '****';
    }
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }

  /**
   * Export configuration for logging (with sensitive values masked)
   */
  toLogSafe(): Record<string, unknown> {
    const safe: Record<string, unknown> = {};
    const sensitiveKeys = [
      'CORTEXDX_ADMIN_TOKEN',
      'CORTEXDX_AUTH0_CLIENT_SECRET',
      'CONTEXT7_API_KEY',
      'SEMANTIC_SCHOLAR_API_KEY',
      'OPENALEX_API_KEY',
      'WIKIDATA_API_KEY',
      'EXA_API_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'DEEPCONTEXT_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
    ];

    for (const [key, value] of Object.entries(this.config)) {
      if (sensitiveKeys.includes(key)) {
        safe[key] = this.getMasked(key as keyof Environment);
      } else {
        safe[key] = value;
      }
    }

    return safe;
  }
}

/**
 * Singleton instance
 */
let environmentInstance: EnvironmentManager | null = null;

/**
 * Get the environment manager instance
 */
export function getEnvironment(): EnvironmentManager {
  if (!environmentInstance) {
    environmentInstance = new EnvironmentManager();
  }
  return environmentInstance;
}

/**
 * Initialize environment (optional - automatically called on first access)
 */
export function initializeEnvironment(): EnvironmentManager {
  environmentInstance = new EnvironmentManager();
  return environmentInstance;
}

/**
 * Export default instance
 */
export const env = getEnvironment();

/**
 * Example usage:
 *
 * import { env } from './config/environment';
 *
 * // Get specific value
 * const port = env.get('PORT');
 *
 * // Check if value exists
 * if (env.has('OPENAI_API_KEY')) {
 *   // Use OpenAI
 * }
 *
 * // Get API key
 * const apiKey = env.getApiKey('context7');
 *
 * // Validate required keys
 * env.validateRequiredKeys(['openai', 'context7']);
 *
 * // Log safe configuration
 * logger.info(env.toLogSafe(), 'Configuration loaded');
 */
