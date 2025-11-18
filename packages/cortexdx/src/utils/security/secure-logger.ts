/**
 * Secure logging utility that prevents credential exposure
 */

type Metadata = Record<string, unknown>;

export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  component: string;
  message: string;
  metadata?: Metadata;
  requestId?: string;
}

export class SecureLogger {
  private static instance: SecureLogger | null = null;
  private logBuffer: LogEntry[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly SENSITIVE_PATTERNS = [
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
  ];

  private constructor() {}

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  private sanitizeMetadata(metadata?: Metadata): Metadata | undefined {
    if (!metadata) return undefined;

    const sanitized: Metadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      const isSensitive = this.SENSITIVE_PATTERNS.some((pattern) =>
        pattern.test(key)
      );

      if (isSensitive) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Metadata);
      } else if (typeof value === "string") {
        sanitized[key] = this.sanitizeStringValue(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeStringValue(value: string): string {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._+=/-]+/gi, "[REDACTED_BEARER_TOKEN]")
      .replace(/Basic\s+[A-Za-z0-9+/_=-]+/gi, "[REDACTED_BASIC_TOKEN]")
      .replace(
        /(api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/gi,
        "$1=[REDACTED]"
      )
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_API_KEY]")
      .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, "[REDACTED_ANTHROPIC_KEY]");
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    let message = `[${timestamp}] [${entry.level.toUpperCase()}] [CortexDx] [${entry.component}] ${entry.message}`;

    if (entry.requestId) {
      message += ` [req:${entry.requestId}]`;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      message += ` ${JSON.stringify(entry.metadata)}`;
    }

    return message;
  }

  private log(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }

    const logMessage = this.formatLogEntry(entry);

    switch (entry.level) {
      case "debug":
        if (process.env.NODE_ENV === "development") {
          console.debug(logMessage);
        }
        break;
      case "info":
        console.info(logMessage);
        break;
      case "warn":
        console.warn(logMessage);
        break;
      case "error":
        console.error(logMessage);
        break;
    }
  }

  debug(
    component: string,
    message: string,
    metadata?: Metadata,
    requestId?: string
  ): void {
    this.log({
      timestamp: new Date(),
      level: "debug",
      component,
      message,
      metadata: this.sanitizeMetadata(metadata),
      requestId,
    });
  }

  info(
    component: string,
    message: string,
    metadata?: Metadata,
    requestId?: string
  ): void {
    this.log({
      timestamp: new Date(),
      level: "info",
      component,
      message,
      metadata: this.sanitizeMetadata(metadata),
      requestId,
    });
  }

  warn(
    component: string,
    message: string,
    metadata?: Metadata,
    requestId?: string
  ): void {
    this.log({
      timestamp: new Date(),
      level: "warn",
      component,
      message,
      metadata: this.sanitizeMetadata(metadata),
      requestId,
    });
  }

  error(
    component: string,
    message: string,
    error?: Error,
    metadata?: Metadata,
    requestId?: string
  ): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stackTrace:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      }),
    };

    this.log({
      timestamp: new Date(),
      level: "error",
      component,
      message,
      metadata: this.sanitizeMetadata(errorMetadata),
      requestId,
    });
  }

  getRecentLogs(count = 100, level?: LogEntry["level"]): LogEntry[] {
    let logs = [...this.logBuffer];
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }
    return logs.slice(-count);
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }
}

export const secureLogger = SecureLogger.getInstance();
