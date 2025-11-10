/**
 * Common code patterns and snippets for automated fixes
 */

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  language: string;
  pattern: string;
  variables?: Record<string, string>;
}

export const CodePatterns: Record<string, CodePattern> = {
  'security.rateLimit': {
    id: 'security.rateLimit',
    name: 'Rate Limiting Middleware',
    description: 'Express rate limiting middleware configuration',
    language: 'typescript',
    pattern: `
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: {{windowMs}}, // {{windowMsDescription}}
  max: {{maxRequests}}, // limit each IP to {{maxRequests}} requests per window
  message: { error: '{{errorMessage}}' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('{{route}}', limiter);
    `,
    variables: {
      windowMs: '15 * 60 * 1000',
      windowMsDescription: '15 minutes',
      maxRequests: '100',
      errorMessage: 'Too many requests, please try again later',
      route: '/mcp',
    },
  },

  'security.headers': {
    id: 'security.headers',
    name: 'Security Headers Middleware',
    description: 'Security headers middleware for Express',
    language: 'typescript',
    pattern: `
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  {{additionalHeaders}}
  next();
});
    `,
    variables: {
      additionalHeaders: "// Add more headers as needed\n  // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');",
    },
  },

  'cors.middleware': {
    id: 'cors.middleware',
    name: 'CORS Middleware Configuration',
    description: 'Environment-aware CORS configuration',
    language: 'typescript',
    pattern: `
import cors from 'cors';

const corsOptions = {
  origin: {{originLogic}},
  methods: [{{allowedMethods}}],
  allowedHeaders: [{{allowedHeaders}}],
  credentials: {{credentials}},
  optionsSuccessStatus: {{optionsSuccessStatus}},
};

app.use('{{route}}', cors(corsOptions));
    `,
    variables: {
      originLogic: `process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true`,
      allowedMethods: "'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'",
      allowedHeaders: "'Content-Type', 'Authorization', 'X-Requested-With'",
      credentials: 'true',
      optionsSuccessStatus: '200',
      route: '/mcp',
    },
  },

  'error.handling': {
    id: 'error.handling',
    name: 'Global Error Handler',
    description: 'Global error handling middleware',
    language: 'typescript',
    pattern: `
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('{{errorPrefix}}', err);

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? '{{productionMessage}}'
    : err.message;

  res.status({{statusCode}}).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});
    `,
    variables: {
      errorPrefix: '[Error]',
      productionMessage: 'Internal server error',
      statusCode: '500',
    },
  },

  'logging.middleware': {
    id: 'logging.middleware',
    name: 'Request Logging Middleware',
    description: 'HTTP request logging middleware',
    language: 'typescript',
    pattern: `
app.use((req, Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path} \${res.statusCode} - \${duration}ms\`);
  });

  next();
});
    `,
    variables: {
      timestamp: 'new Date().toISOString()',
    },
  },

  'health.check': {
    id: 'health.check',
    name: 'Health Check Endpoint',
    description: 'Basic health check endpoint',
    language: 'typescript',
    pattern: `
app.get('{{healthEndpoint}}', (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  };

  res.status(200).json(health);
});
    `,
    variables: {
      healthEndpoint: '/health',
    },
  },

  'sse.connection': {
    id: 'sse.connection',
    name: 'SSE Connection Handler',
    description: 'Server-Sent Events connection handler with cleanup',
    language: 'typescript',
    pattern: `
export class SSEConnection {
  private connections = new Map<string, { response: Response; cleanup: () => void }>();

  async handleConnection(req: Request): Promise<Response> {
    const sessionId = this.generateSessionId();
    const response = new Response();

    // Set SSE headers
    response.headers.set('Content-Type', 'text/event-stream');
    response.headers.set('Cache-Control', 'no-cache');
    response.headers.set('Connection', 'keep-alive');

    // Setup cleanup
    const cleanup = () => {
      this.connections.delete(sessionId);
      this.heartbeat.delete(sessionId);
    };

    this.connections.set(sessionId, { response, cleanup });

    // Setup heartbeat
    const heartbeat = setInterval(() => {
      if (this.connections.has(sessionId)) {
        response.write(': heartbeat\\n\\n');
      } else {
        clearInterval(heartbeat);
      }
    }, {{heartbeatInterval}});

    this.heartbeat.set(sessionId, heartbeat);

    // Cleanup on disconnect
    req.signal.addEventListener('abort', cleanup);

    return response;
  }

  private generateSessionId(): string {
    return \`sse_\${Date.now()}_\${Math.random().toString(36).slice(2)}\`;
  }
}
    `,
    variables: {
      heartbeatInterval: '30000', // 30 seconds
    },
  },

  'memory.monitor': {
    id: 'memory.monitor',
    name: 'Memory Monitor',
    description: 'Memory usage monitoring with alerts',
    language: 'typescript',
    pattern: `
export class MemoryMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private threshold = {{memoryThreshold}}; // MB

  start(intervalMs: number = {{checkInterval}}): void {
    this.checkInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(usage.heapTotal / 1024 / 1024);

      console.log(\`[Memory] \${usedMB}MB / \${totalMB}MB\`);

      if (usedMB > this.threshold) {
        console.warn(\`[Memory] High memory usage: \${usedMB}MB (threshold: \${this.threshold}MB)\`);

        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
    `,
    variables: {
      memoryThreshold: '500',
      checkInterval: '60000', // 1 minute
    },
  },

  'jsonrpc.batch.handler': {
    id: 'jsonrpc.batch.handler',
    name: 'JSON-RPC Batch Handler',
    description: 'JSON-RPC batch request handler with proper error handling',
    language: 'typescript',
    pattern: `
export async function handleBatchRequest(
  requests: JsonRpcRequest[],
  context: RequestContext
): Promise<JsonRpcResponse[]> {
  // Validate batch request
  if (!Array.isArray(requests)) {
    throw new Error('Batch request must be an array');
  }

  // Process requests in parallel but maintain order
  const responses = await Promise.all(
    requests.map(async (request) => {
      try {
        // Validate ID type
        const id = typeof request.id === 'string' || typeof request.id === 'number'
          ? request.id
          : null;

        const result = await processIndividualRequest(request, context);

        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: error.code || -32603,
            message: error.message || 'Internal error',
            data: error.data,
          },
        };
      }
    })
  );

  return responses;
}
    `,
  },
};

/**
 * Get code pattern by ID
 */
export function getCodePattern(id: string): CodePattern | undefined {
  return CodePatterns[id];
}

/**
 * Render code pattern with variables
 */
export function renderCodePattern(
  patternId: string,
  variables: Record<string, string> = {}
): string {
  const pattern = getCodePattern(patternId);
  if (!pattern) {
    throw new Error(`Code pattern ${patternId} not found`);
  }

  let code = pattern.pattern;

  // Apply pattern variables first
  if (pattern.variables) {
    for (const [key, value] of Object.entries(pattern.variables)) {
      code = code.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
  }

  // Apply custom variables (can override pattern defaults)
  for (const [key, value] of Object.entries(variables)) {
    code = code.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return code;
}

/**
 * Get all code patterns
 */
export function getAllCodePatterns(): CodePattern[] {
  return Object.values(CodePatterns);
}

/**
 * Get code patterns by language
 */
export function getCodePatternsByLanguage(language: string): CodePattern[] {
  return Object.values(CodePatterns).filter(pattern => pattern.language === language);
}