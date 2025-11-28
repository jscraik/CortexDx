import pino, { type Logger as PinoLogger, stdTimeFunctions } from 'pino';

const DEFAULT_LEVEL =
  process.env.CORTEXDX_LOG_LEVEL ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const baseLogger = pino({
  level: DEFAULT_LEVEL,
  base: {
    brand: 'brAInwav',
    service: 'cortexdx',
  },
  timestamp: stdTimeFunctions.isoTime,
  messageKey: 'message',
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

export function createLogger(options: LoggerOptions | string = {}): CortexLogger {
  if (typeof options === 'string') {
    return baseLogger.child({ component: options });
  }
  const component = options.component ? { component: options.component } : {};
  return baseLogger.child({ ...component, ...(options.context ?? {}) });
}

export interface CliLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
  structured: CortexLogger;
}

export interface CliLoggerOptions extends LoggerOptions {
  silent?: boolean;
  writer?: (text: string) => void;
  errorWriter?: (text: string) => void;
}

export function createCliLogger(options: CliLoggerOptions | string): CliLogger {
  const config = typeof options === 'string' ? { component: options } : options;
  const structured = createLogger(config);
  const infoWriter =
    config.writer ??
    ((text: string) => {
      console.log(text);
    });
  const errorWriter =
    config.errorWriter ??
    ((text: string) => {
      console.error(text);
    });
  const silent = config.silent ?? false;

  const emit =
    (
      level: keyof CortexLogger,
      label: string,
      destination: (text: string) => void,
    ) =>
    (message: string, fields?: Record<string, unknown>) => {
      switch (level) {
        case 'info':
          structured.info(fields ?? {}, message);
          break;
        case 'warn':
          structured.warn(fields ?? {}, message);
          break;
        case 'error':
          structured.error(fields ?? {}, message);
          break;
        case 'debug':
          structured.debug(fields ?? {}, message);
          break;
        case 'trace':
          structured.trace(fields ?? {}, message);
          break;
        case 'fatal':
          structured.fatal(fields ?? {}, message);
          break;
        default:
          structured.info(fields ?? {}, message);
      }
      if (!silent) {
        destination(`[${label}] ${message}`);
      }
    };

  return {
    info: emit('info', 'INFO', infoWriter),
    warn: emit('warn', 'WARN', infoWriter),
    error: emit('error', 'ERROR', errorWriter),
    debug: emit('debug', 'DEBUG', infoWriter),
    structured,
  };
}

export function logBanner(
  logger: CortexLogger,
  title: string,
  lines: string[],
): void {
  const border = '═'.repeat(Math.max(title.length, ...lines.map((line) => line.length)) + 4);
  logger.info({ banner: title }, `╔${border}╗`);
  logger.info({ banner: title }, `║  ${title}  ║`);
  for (const line of lines) {
    logger.info({ banner: title }, `║  ${line.padEnd(border.length - 4, ' ')}  ║`);
  }
  logger.info({ banner: title }, `╚${border}╝`);
}
