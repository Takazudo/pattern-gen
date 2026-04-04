/**
 * Parse vimrc content into executable command lines.
 * Skips blank lines and lines starting with " (vimscript comments).
 */
export function parseVimrc(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('"'));
}
