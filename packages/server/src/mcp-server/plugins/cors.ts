/**
 * CORS Plugin
 * Handles Cross-Origin Resource Sharing for HTTP transports
 */

import { createLogger } from '../../logging/logger.js';
import { MCP_ERRORS } from '../core/errors.js';
import type { ServerPlugin, RequestContext, CorsPluginConfig } from './types.js';
import type { JsonRpcResponse } from '../transports/types.js';

const logger = createLogger({ component: 'cors-plugin' });

/**
 * Create CORS plugin
 */
export function createCorsPlugin(config: CorsPluginConfig): ServerPlugin {
  const {
    allowedOrigins,
    allowedMethods = ['GET', 'POST', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'MCP-Protocol-Version'],
    maxAge = 86400,
    strictOriginCheck = true,
  } = config;

  // Normalize origins to lowercase
  const normalizedOrigins = allowedOrigins.map(o => o.toLowerCase());

  return {
    name: 'cors',
    version: '1.0.0',
    priority: 5, // Run very early

    async onRequest(ctx: RequestContext): Promise<JsonRpcResponse | undefined> {
      // Get origin from state (set by transport layer)
      const origin = ctx.state.get('origin') as string | undefined;

      if (!origin) {
        // No origin header - not a browser request
        return undefined;
      }

      const normalizedOrigin = origin.toLowerCase();
      const isAllowed = normalizedOrigins.some(
        allowed => normalizedOrigin === allowed ||
        allowed === '*' ||
        (allowed.startsWith('*.') && normalizedOrigin.endsWith(allowed.slice(1)))
      );

      if (!isAllowed) {
        if (strictOriginCheck) {
          logger.warn({ origin }, 'CORS: Origin not allowed');
          return {
            jsonrpc: '2.0',
            id: ctx.request.id ?? null,
            error: {
              code: MCP_ERRORS.ACCESS_DENIED,
              message: 'Origin not allowed',
              data: { origin },
            },
          };
        }
        logger.debug({ origin }, 'CORS: Origin not in allowed list (non-strict mode)');
      }

      // Store CORS config in state for response handling
      ctx.state.set('cors', {
        origin: isAllowed ? origin : undefined,
        methods: allowedMethods,
        headers: allowedHeaders,
        maxAge,
      });

      return undefined;
    },

    async onResponse(
      ctx: RequestContext,
      response: JsonRpcResponse
    ): Promise<JsonRpcResponse> {
      // CORS headers are typically set by the transport layer
      // This hook can add metadata to the response if needed
      return response;
    },
  };
}

/**
 * Default CORS configuration for development
 */
export const DEFAULT_CORS_CONFIG: CorsPluginConfig = {
  allowedOrigins: [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id'],
  maxAge: 86400,
  strictOriginCheck: true,
};

/**
 * Permissive CORS configuration (use with caution)
 */
export const PERMISSIVE_CORS_CONFIG: CorsPluginConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  maxAge: 86400,
  strictOriginCheck: false,
};
