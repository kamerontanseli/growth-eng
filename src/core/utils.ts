/**
 * Shared utility functions
 */

/**
 * Join strings into a single newline-separated string
 *
 * @param args The lines to join
 * @returns The joined string, with each argument separated by a newline
 */
export function lines(...args: string[]): string {
  return args.join("\n");
}
