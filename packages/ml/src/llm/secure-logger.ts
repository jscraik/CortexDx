/**
 * Secure logging utility that prevents credential exposure.
 */

type Metadata = Record<string, unknown>;

const APP_NAME = process.env.APP_NAME || "[APP_NAME]";

export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  component: string;
  message: string;
  metadata?: Metadata;
  requestId?: string;
  userId?: string;
}

function redactTokens(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._+=/-]+/gi, "[REDACTED_BEARER_TOKEN]")
    .replace(/Basic\s+[A-Za-z0-9+/_=-]+/gi, "[REDACTED_BASIC_TOKEN]")
    .replace(/(api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
    .replace(/mcp-auth-token\s*[:=]\s*[A-Za-z0-9._\-]{20,}/gi, "mcp-auth-token=[REDACTED_MCP_AUTH_TOKEN]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[REDACTED_TOKEN]");
}

function sanitizeMetadata(metadata?: Metadata): Metadata | undefined {
  if (!metadata) return undefined;

  const SENSITIVE_PATTERNS = [
    /api[_-]?key/i,
    /password/i,
    /token/i,
    /secret/i,
    /credential/i,
    /auth/i,
    /bearer/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /authorization/i,
    /cookie/i,
    /session/i,
    /mcp[_-]?(auth|session)/i,
  ];

  const sanitized: Metadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      sanitized[key] = redactTokens(value);
      continue;
    }
    if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Metadata);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString();
  let message = `[${timestamp}] [${entry.level.toUpperCase()}] [${APP_NAME}] [${entry.component}] ${entry.message}`;
  if (entry.requestId) {
    message += ` [req:${entry.requestId}]`;
  }
  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    message += ` ${JSON.stringify(entry.metadata)}`;
  }
  return message;
}

export class SecureLogger {
  private static instance: SecureLogger | null = null;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  private push(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }
  }

  private log(entry: LogEntry): void {
    const sanitizedMetadata = sanitizeMetadata(entry.metadata);
    const sanitizedEntry = { ...entry, metadata: sanitizedMetadata };
    this.push(sanitizedEntry);
    const output = formatLogEntry(sanitizedEntry);
    if (entry.level === "debug" && process.env.NODE_ENV !== "development") {
      return;
    }
    if (entry.level === "debug") {
      console.debug(output);
    } else if (entry.level === "info") {
      console.info(output);
    } else if (entry.level === "warn") {
      console.warn(output);
    } else {
      console.error(output);
    }
  }

  debug(component: string, message: string, metadata?: Metadata, requestId?: string): void {
    this.log({ timestamp: new Date(), level: "debug", component, message, metadata, requestId });
  }

  info(component: string, message: string, metadata?: Metadata, requestId?: string): void {
    this.log({ timestamp: new Date(), level: "info", component, message, metadata, requestId });
  }

  warn(component: string, message: string, metadata?: Metadata, requestId?: string): void {
    this.log({ timestamp: new Date(), level: "warn", component, message, metadata, requestId });
  }

  error(
    component: string,
    message: string,
    error?: Error,
    metadata?: Metadata,
    requestId?: string,
  ): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stackTrace: process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
    };
    this.log({ timestamp: new Date(), level: "error", component, message, metadata: errorMetadata, requestId });
  }

  getRecentLogs(count = 100, level?: LogEntry["level"]): LogEntry[] {
    let logs = [...this.logBuffer];
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }
    return logs.slice(-count);
  }
}

export const secureLogger = SecureLogger.getInstance();
