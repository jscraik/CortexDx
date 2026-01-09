/**
 * CLI Utilities Index
 *
 * Central export point for CLI utilities, constants, and helpers.
 * Provides a unified interface for CLI enhancements following clig.dev conventions.
 */

// Constants and error codes
export * from "./constants.js";

// Output utilities (JSON schema versioning, plain mode)
export * from "./output.js";

// TTY detection and interactive mode
export * from "./tty.js";

// Command suggestions ("did you mean?")
export * from "./suggestions.js";

// Shell completions generator
export * from "./completions.js";
