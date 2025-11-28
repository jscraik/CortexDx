import pino, { type Logger as PinoLogger, stdTimeFunctions } from "pino";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const DEFAULT_LEVEL =
  process.env.CORTEXDX_LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const baseLogger = pino({
  level: DEFAULT_LEVEL,
  base: {
    brand: "brAInwav",
    service: "cortexdx",
  },
  timestamp: stdTimeFunctions.isoTime,
  messageKey: "message",
  formatters: {
    bindings(bindings: Record<string, unknown>) {
      return { pid: bindings.pid, hostname: bindings.hostname };
    },
    level(label: string) {
      return { severity: label.toUpperCase() };
    },
  },
});

export type CortexLogger = PinoLogger;

export interface LoggerOptions {
  component?: string;
  context?: Record<string, unknown>;
}

export function createLogger(
  options: LoggerOptions | string = {},
): CortexLogger {
  if (typeof options === "string") {
    return baseLogger.child({ component: options });
  }
  const component = options.component ? { component: options.component } : {};
  return baseLogger.child({ ...component, ...(options.context ?? {}) });
}

/**
 * CLI Logger interface with human-friendly signature (message, fields).
 * Note: This differs from pino's (fields, message) order intentionally
 * to provide a more ergonomic CLI logging experience.
 */
export interface CliLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
  /** Access the underlying pino logger for advanced use cases */
  structured: CortexLogger;
}

export interface CliLoggerOptions extends LoggerOptions {
  silent?: boolean;
  writer?: (text: string) => void;
  errorWriter?: (text: string) => void;
}

function logToStructured(
  structured: CortexLogger,
  level: LogLevel,
  message: string,
  fields: Record<string, unknown>,
): void {
  const logMethods: Record<LogLevel, () => void> = {
    info: () => structured.info(fields, message),
    warn: () => structured.warn(fields, message),
    error: () => structured.error(fields, message),
    debug: () => structured.debug(fields, message),
    trace: () => structured.trace(fields, message),
    fatal: () => structured.fatal(fields, message),
  };
  (logMethods[level] ?? logMethods.info)();
}

function createEmitHandler(
  structured: CortexLogger,
  level: LogLevel,
  label: string,
  destination: (text: string) => void,
  silent: boolean,
): (message: string, fields?: Record<string, unknown>) => void {
  return (message: string, fields?: Record<string, unknown>) => {
    logToStructured(structured, level, message, fields ?? {});
    if (!silent) {
      destination(`[${label}] ${message}`);
    }
  };
}

export function createCliLogger(options: CliLoggerOptions | string): CliLogger {
  const config = typeof options === "string" ? { component: options } : options;
  const structured = createLogger(config);
  const infoWriter = config.writer ?? ((text: string) => console.log(text));
  const errorWriter = config.errorWriter ?? ((text: string) => console.error(text));
  const silent = config.silent ?? false;

  return {
    info: createEmitHandler(structured, "info", "INFO", infoWriter, silent),
    warn: createEmitHandler(structured, "warn", "WARN", infoWriter, silent),
    error: createEmitHandler(structured, "error", "ERROR", errorWriter, silent),
    debug: createEmitHandler(structured, "debug", "DEBUG", infoWriter, silent),
    structured,
  };
}

export function logBanner(
  logger: CortexLogger,
  title: string,
  lines: string[],
): void {
  const contentWidth = Math.max(
    title.length,
    ...lines.map((line) => line.length),
  );
  const border = "═".repeat(contentWidth + 4);
  logger.info({ banner: title }, `╔${border}╗`);
  logger.info({ banner: title }, `║  ${title.padEnd(contentWidth, " ")}  ║`);
  for (const line of lines) {
    logger.info({ banner: title }, `║  ${line.padEnd(contentWidth, " ")}  ║`);
  }
  logger.info({ banner: title }, `╚${border}╝`);
}
