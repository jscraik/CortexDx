/**
 * CLI Utilities
 * Provides progress indicators, formatting, and helper functions for CLI
 */

interface ProgressIndicator {
  start: () => void;
  stop: () => void;
  update: (message: string) => void;
}

/**
 * Create a progress indicator for long-running operations
 */
export const createProgressIndicator = (
  initialMessage: string,
  useColor: boolean,
): ProgressIndicator => {
  let interval: NodeJS.Timeout | null = null;
  let currentMessage = initialMessage;
  let frame = 0;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  const render = () => {
    const spinner = frames[frame % frames.length];
    const coloredSpinner = useColor ? `\x1b[36m${spinner}\x1b[0m` : spinner;
    process.stdout.write(`\r${coloredSpinner} ${currentMessage}`);
    frame++;
  };

  return {
    start: () => {
      if (interval) return;
      frame = 0;
      interval = setInterval(render, 80);
    },

    stop: () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write("\r\x1b[K"); // Clear line
    },

    update: (message: string) => {
      currentMessage = message;
    },
  };
};

/**
 * Format output with colors and severity levels
 */
export const formatOutput = (
  message: string,
  type: "info" | "success" | "warning" | "error" | "prompt",
  useColor: boolean,
): string => {
  if (!useColor) {
    return message;
  }

  const colors = {
    info: "\x1b[0m", // Default
    success: "\x1b[32m", // Green
    warning: "\x1b[33m", // Yellow
    error: "\x1b[31m", // Red
    prompt: "\x1b[36m", // Cyan
  };

  const reset = "\x1b[0m";
  return `${colors[type]}${message}${reset}`;
};

/**
 * Parse comma-separated values
 */
export const parseCSV = (csv: string): string[] => {
  return csv
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

/**
 * Format duration in human-readable format
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};

/**
 * Create a table for displaying structured data
 */
export const createTable = (
  headers: string[],
  rows: string[][],
  useColor: boolean,
): string => {
  const columnWidths = headers.map((header, i) => {
    const maxRowWidth = Math.max(...rows.map((row) => (row[i] || "").length));
    return Math.max(header.length, maxRowWidth);
  });

  const separator = columnWidths
    .map((width) => "-".repeat(width + 2))
    .join("+");
  const headerRow = headers
    .map((header, i) => ` ${header.padEnd(columnWidths[i] ?? 0)} `)
    .join("|");

  const dataRows = rows.map((row) =>
    row
      .map((cell, i) => ` ${(cell || "").padEnd(columnWidths[i] ?? 0)} `)
      .join("|"),
  );

  const table = [separator, headerRow, separator, ...dataRows, separator].join(
    "\n",
  );

  return useColor ? formatOutput(table, "info", true) : table;
};

/**
 * Display a list with bullets
 */
export const formatList = (items: string[], useColor: boolean): string => {
  const bullet = useColor ? formatOutput("•", "info", true) : "•";
  return items.map((item) => `${bullet} ${item}`).join("\n");
};

/**
 * Create a box around text
 */
export const createBox = (text: string, useColor: boolean): string => {
  const lines = text.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  const border = "─".repeat(maxLength + 2);

  const top = `┌${border}┐`;
  const bottom = `└${border}┘`;
  const content = lines
    .map((line) => `│ ${line.padEnd(maxLength)} │`)
    .join("\n");

  const box = [top, content, bottom].join("\n");
  return useColor ? formatOutput(box, "info", true) : box;
};

/**
 * Display a progress bar
 */
export const createProgressBar = (
  current: number,
  total: number,
  useColor: boolean,
  width = 40,
): string => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percentText = `${percentage.toFixed(1)}%`;

  const progressBar = `[${bar}] ${percentText}`;
  return useColor ? formatOutput(progressBar, "info", true) : progressBar;
};

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)}...`;
};

/**
 * Display a confirmation prompt
 */
export const confirm = async (
  message: string,
  useColor: boolean,
): Promise<boolean> => {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = formatOutput(`${message} (y/n): `, "prompt", useColor);
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
};
