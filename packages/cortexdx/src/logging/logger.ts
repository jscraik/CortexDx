// Re-export from core package logging module
// Use relative path since both packages are in the same monorepo
import { logging } from "../../../core/src/index.js";

// Re-export logging functions for backward compatibility
export const createLogger = logging.createLogger;
export const createCliLogger = logging.createCliLogger;
export const logBanner = logging.logBanner;

// Re-export types
export type {
  CortexLogger,
  CliLogger,
  CliLoggerOptions,
  LoggerOptions,
} from "../../../core/src/index.js";
