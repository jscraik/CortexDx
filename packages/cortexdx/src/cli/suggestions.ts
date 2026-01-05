/**
 * Command Suggestion Utilities
 *
 * Provides "did you mean?" suggestions for typos and unknown commands.
 * Uses Levenshtein distance for fuzzy matching.
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find best matching command from available commands
 */
export function findClosestCommand(
  input: string,
  available: string[],
  threshold = 3,
): string | null {
  if (available.length === 0) return null;

  // Find commands with distance <= threshold
  const matches = available
    .map((cmd) => ({
      cmd,
      distance: levenshtein(input.toLowerCase(), cmd.toLowerCase()),
    }))
    .filter((match) => match.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  if (matches.length === 0) return null;

  // Return the closest match
  return matches[0].cmd;
}

/**
 * Get suggestion text for unknown command
 */
export function getSuggestionText(
  input: string,
  available: string[],
  threshold = 3,
): string | null {
  const suggestion = findClosestCommand(input, available, threshold);
  if (!suggestion) return null;
  return `Did you mean '${suggestion}'?`;
}

/**
 * Suggestion result
 */
export interface SuggestionResult {
  /** The suggested command */
  command: string;
  /** The original input */
  input: string;
  /** Edit distance */
  distance: number;
}

/**
 * Find multiple suggestions for a given input
 */
export function findSuggestions(
  input: string,
  available: string[],
  maxSuggestions = 3,
  threshold = 3,
): SuggestionResult[] {
  if (available.length === 0) return [];

  const results = available
    .map((cmd) => ({
      command: cmd,
      input,
      distance: levenshtein(input.toLowerCase(), cmd.toLowerCase()),
    }))
    .filter((result) => result.distance <= threshold)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions);

  return results;
}

/**
 * Format suggestions for display
 */
export function formatSuggestions(suggestions: SuggestionResult[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) {
    return `Did you mean '${suggestions[0].command}'?`;
  }
  const commands = suggestions.map((s) => `'${s.command}'`).join(", ");
  return `Did you mean one of: ${commands}?`;
}

/**
 * Check if input is similar to available command
 */
export function isSimilarCommand(input: string, available: string[], threshold = 2): boolean {
  const closest = findClosestCommand(input, available, threshold);
  return closest !== null;
}
