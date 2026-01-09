/**
 * CLI Constants
 *
 * Standard exit codes, error codes, and schema versions for CortexDx CLI.
 * Follows POSIX/GNU conventions and CLI best practices (clig.dev).
 *
 * Exit Code Reference:
 * - 0: success
 * - 1: generic failure
 * - 2: invalid usage / validation failure
 * - 3: policy refusal / missing required metadata
 * - 4: partial success / partial failure
 * - 130: user abort (Ctrl-C)
 */

/**
 * Standard exit codes
 */
export const ExitCode = {
  /** Success */
  Success: 0,
  /** Generic failure */
  Failure: 1,
  /** Invalid usage / validation failure */
  Usage: 2,
  /** Policy refusal / missing required metadata */
  Policy: 3,
  /** Partial success / partial failure */
  Partial: 4,
  /** User abort (Ctrl-C) */
  Abort: 130,
} as const;

/**
 * Error code namespace for machine-parseable error output
 * These codes are included in JSON output under errors[].code
 */
export const ErrorCode = {
  /** Invalid arguments or command misuse */
  E_USAGE: "E_USAGE",
  /** Input validation failed */
  E_VALIDATION: "E_VALIDATION",
  /** Policy refusal / missing metadata */
  E_POLICY: "E_POLICY",
  /** Partial success / partial failure */
  E_PARTIAL: "E_PARTIAL",
  /** Authentication or permission failure */
  E_AUTH: "E_AUTH",
  /** Network failure or timeout */
  E_NETWORK: "E_NETWORK",
  /** File not found or inaccessible */
  E_FILE_NOT_FOUND: "E_FILE_NOT_FOUND",
  /** Unexpected internal error */
  E_INTERNAL: "E_INTERNAL",
} as const;

/**
 * Schema version identifiers for JSON output
 * Format: cortexdx.{command}.{version}
 */
export const SchemaVersion = {
  /** Diagnose command output schema */
  Diagnose: "cortexdx.diagnose.v1",
  /** Compare command output schema */
  Compare: "cortexdx.compare.v1",
  /** Doctor command output schema */
  Doctor: "cortexdx.doctor.v1",
  /** Research command output schema */
  Research: "cortexdx.research.v1",
  /** SBOM command output schema */
  Sbom: "cortexdx.sbom.v1",
  /** Orchestrate command output schema */
  Orchestrate: "cortexdx.orchestrate.v1",
  /** Health command output schema */
  Health: "cortexdx.health.v1",
  /** Self-healing command output schema */
  SelfHeal: "cortexdx.selfheal.v1",
  /** Templates command output schema */
  Templates: "cortexdx.templates.v1",
} as const;

/**
 * Documentation URLs referenced in help text
 */
export const DocsUrls = {
  Main: "https://docs.brainwav.ai/cortexdx",
  Api: "https://docs.brainwav.ai/cortexdx/api",
  Guide: "https://docs.brainwav.ai/cortexdx/guide",
  Issues: "https://github.com/brainwav/cortexdx/issues",
} as const;

/**
 * Config source precedence order (highest to lowest)
 */
export const ConfigPrecedence = {
  /** Command-line flags (highest priority) */
  Flags: "flags",
  /** Environment variables */
  Environment: "environment",
  /** Project-local config (.cortexdx/config.json) */
  Project: "project",
  /** User config (~/.config/cortexdx/config.json) */
  User: "user",
  /** System config (/etc/cortexdx/config.json) */
  System: "system",
} as const;

/**
 * TTY detection results
 */
export const TtyStatus = {
  /** Both stdin and stdout are TTY */
  Full: "full",
  /** Only stdout is TTY */
  OutputOnly: "output-only",
  /** Only stdin is TTY */
  InputOnly: "input-only",
  /** Neither stdin nor stdout is TTY */
  None: "none",
} as const;

/**
 * Verbosity levels for --quiet, --verbose, --debug flags
 */
export const LogLevel = {
  /** Suppress non-essential output (only errors) */
  Quiet: "quiet",
  /** Default output level */
  Normal: "normal",
  /** Include diagnostics and timing info */
  Verbose: "verbose",
  /** Include internal detail (stack traces, etc.) */
  Debug: "debug",
} as const;

/**
 * Standard environment variables recognized by CortexDx
 */
export const EnvVar = {
  /** Logging level (quiet, normal, verbose, debug) */
  LogLevel: "CORTEXDX_LOG_LEVEL",
  /** Disable ANSI colors */
  NoColor: "NO_COLOR",
  /** Terminal type (dumb = no color) */
  Term: "TERM",
  /** Config file path override */
  Config: "CORTEXDX_CONFIG",
  /** Disable SSE transport */
  DisableSse: "CORTEXDX_DISABLE_SSE",
  /** SSE endpoint override */
  SseEndpoint: "CORTEXDX_SSE_ENDPOINT",
  /** Dependency Track base URL */
  DtUrl: "CORTEXDX_DT_URL",
  /** Dependency Track API key */
  DtApiKey: "CORTEXDX_DT_API_KEY",
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
export type SchemaVersion = (typeof SchemaVersion)[keyof typeof SchemaVersion];
export type TtyStatus = (typeof TtyStatus)[keyof typeof TtyStatus];
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
