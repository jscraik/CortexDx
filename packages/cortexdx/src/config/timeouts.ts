/**
 * Centralized timeout configuration
 * All timeouts can be overridden via environment variables
 */

export interface TimeoutConfig {
  /**
   * Default timeout for inspector jobs (ms)
   */
  inspector: number;

  /**
   * Timeout for Ollama requests (ms)
   */
  ollama: number;

  /**
   * Timeout for embedding requests (ms)
   */
  embedding: number;

  /**
   * Timeout for stdio wrapper operations (ms)
   */
  stdioWrapper: number;

  /**
   * Timeout for problem resolver operations (ms)
   */
  problemResolver: number;

  /**
   * Timeout for HTTP MCP client requests (ms)
   */
  httpMcpClient: number;

  /**
   * Timeout for plugin orchestrator stages (ms)
   */
  pluginOrchestrator: number;

  /**
   * Timeout for human-in-loop interactions (ms)
   */
  humanInLoop: number;

  /**
   * Timeout for integration tests (ms)
   */
  integrationTest: number;

  /**
   * Timeout for handshake verification (ms)
   */
  handshake: number;
}

// Default timeout values (in milliseconds)
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  inspector: 30000, // 30 seconds
  ollama: 30000, // 30 seconds
  embedding: 30000, // 30 seconds
  stdioWrapper: 30000, // 30 seconds
  problemResolver: 30000, // 30 seconds
  httpMcpClient: 30000, // 30 seconds
  pluginOrchestrator: 30000, // 30 seconds
  humanInLoop: 300000, // 5 minutes
  integrationTest: 30000, // 30 seconds
  handshake: 5000, // 5 seconds
};

/**
 * Parse timeout value from environment variable
 */
function parseTimeout(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return defaultValue;
  }

  return parsed;
}

/**
 * Get timeout configuration from environment variables
 */
export function getTimeoutConfig(): TimeoutConfig {
  return {
    inspector: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_INSPECTOR || process.env.TIMEOUT_INSPECTOR,
      DEFAULT_TIMEOUTS.inspector,
    ),
    ollama: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_OLLAMA || process.env.TIMEOUT_OLLAMA,
      DEFAULT_TIMEOUTS.ollama,
    ),
    embedding: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_EMBEDDING || process.env.TIMEOUT_EMBEDDING,
      DEFAULT_TIMEOUTS.embedding,
    ),
    stdioWrapper: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_STDIO_WRAPPER || process.env.TIMEOUT_STDIO_WRAPPER,
      DEFAULT_TIMEOUTS.stdioWrapper,
    ),
    problemResolver: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_PROBLEM_RESOLVER || process.env.TIMEOUT_PROBLEM_RESOLVER,
      DEFAULT_TIMEOUTS.problemResolver,
    ),
    httpMcpClient: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_HTTP_MCP_CLIENT || process.env.TIMEOUT_HTTP_MCP_CLIENT,
      DEFAULT_TIMEOUTS.httpMcpClient,
    ),
    pluginOrchestrator: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_PLUGIN_ORCHESTRATOR ||
        process.env.TIMEOUT_PLUGIN_ORCHESTRATOR,
      DEFAULT_TIMEOUTS.pluginOrchestrator,
    ),
    humanInLoop: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_HUMAN_IN_LOOP || process.env.TIMEOUT_HUMAN_IN_LOOP,
      DEFAULT_TIMEOUTS.humanInLoop,
    ),
    integrationTest: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_INTEGRATION_TEST || process.env.TIMEOUT_INTEGRATION_TEST,
      DEFAULT_TIMEOUTS.integrationTest,
    ),
    handshake: parseTimeout(
      process.env.CORTEXDX_TIMEOUT_HANDSHAKE || process.env.TIMEOUT_HANDSHAKE,
      DEFAULT_TIMEOUTS.handshake,
    ),
  };
}

/**
 * Get a specific timeout value
 */
export function getTimeout(key: keyof TimeoutConfig): number {
  const config = getTimeoutConfig();
  return config[key];
}

/**
 * Set global timeout for all operations (override)
 * This can be useful for testing or when you want all timeouts to be the same
 */
export function getGlobalTimeout(): number | null {
  const globalTimeout = process.env.CORTEXDX_GLOBAL_TIMEOUT || process.env.GLOBAL_TIMEOUT;
  if (!globalTimeout) return null;

  const parsed = Number.parseInt(globalTimeout, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

/**
 * Get timeout with global override support
 */
export function getTimeoutWithOverride(key: keyof TimeoutConfig): number {
  const globalTimeout = getGlobalTimeout();
  if (globalTimeout !== null) {
    return globalTimeout;
  }

  return getTimeout(key);
}

// Export default timeouts for reference
export { DEFAULT_TIMEOUTS };
