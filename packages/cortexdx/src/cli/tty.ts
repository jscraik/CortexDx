/**
 * TTY Detection Utilities
 *
 * Detects terminal capabilities for interactive mode, color output,
 * and script-friendly automation. Follows clig.dev conventions.
 */

import type { TtyStatus } from "./constants.js";

/**
 * TTY detection result
 */
export interface TtyInfo {
  /** Overall TTY status */
  status: TtyStatus;
  /** Is stdin a TTY? */
  stdinIsTTY: boolean;
  /** Is stdout a TTY? */
  stdoutIsTTY: boolean;
  /** Is stderr a TTY? */
  stderrIsTTY: boolean;
  /** Should we use color? */
  useColor: boolean;
  /** Should we allow interactive prompts? */
  allowInteractive: boolean;
}

/**
 * Detect TTY status
 */
export function detectTty(): TtyInfo {
  const stdinIsTTY = process.stdin.isTTY;
  const stdoutIsTTY = process.stdout.isTTY;
  const stderrIsTTY = process.stderr.isTTY;

  // Determine overall status
  let status: TtyStatus;
  if (stdinIsTTY && stdoutIsTTY) {
    status = "full";
  } else if (stdoutIsTTY && !stdinIsTTY) {
    status = "output-only";
  } else if (stdinIsTTY && !stdoutIsTTY) {
    status = "input-only";
  } else {
    status = "none";
  }

  // Color output: respect NO_COLOR and TERM=dumb
  const noColorEnv = process.env.NO_COLOR?.toLowerCase() === "1";
  const dumbTerm = process.env.TERM?.toLowerCase() === "dumb";
  const useColor = stdoutIsTTY && !noColorEnv && !dumbTerm;

  // Interactive mode requires both stdin and stdout to be TTY
  const allowInteractive = stdinIsTTY && stdoutIsTTY;

  return {
    status,
    stdinIsTTY,
    stdoutIsTTY,
    stderrIsTTY,
    useColor,
    allowInteractive,
  };
}

/**
 * Check if we should allow interactive prompts
 * Returns false if --no-input was specified or not a TTY
 */
export function canPrompt(noInputFlag: boolean): boolean {
  if (noInputFlag) return false;
  const tty = detectTty();
  return tty.allowInteractive;
}

/**
 * Error when interactive input is required but --no-input is set
 */
export class NoInputError extends Error {
  constructor(
    message = "Interactive input required but --no-input was specified",
  ) {
    super(message);
    this.name = "NoInputError";
  }
}

/**
 * Ensure interactive mode is available, throw error if not
 * Use this before prompting for input
 */
export function requireInteractive(noInputFlag: boolean): void {
  if (!canPrompt(noInputFlag)) {
    const tty = detectTty();
    if (noInputFlag) {
      throw new NoInputError(
        "Interactive input required. Use --no-input only for non-interactive scripts.",
      );
    }
    throw new NoInputError(
      `Interactive input required but not a TTY (stdin: ${tty.stdinIsTTY}, stdout: ${tty.stdoutIsTTY})`,
    );
  }
}

/**
 * Check if color output should be used
 */
export function shouldUseColor(
  forceColor?: boolean,
  noColorFlag?: boolean,
): boolean {
  if (noColorFlag) return false;
  if (forceColor) return true;
  const tty = detectTty();
  return tty.useColor;
}

/**
 * Get appropriate output stream for messages
 */
export function getOutputStream(isError = false): NodeJS.WriteStream {
  return isError ? process.stderr : process.stdout;
}

/**
 * Write to stdout if TTY, otherwise skip (for animations/spinners)
 */
export function writeIfTty(data: string, isError = false): boolean {
  const stream = getOutputStream(isError);
  if (stream.isTTY) {
    stream.write(data);
    return true;
  }
  return false;
}
