/**
 * Escapes the `ilike` wildcards (`%`, `_`) and the escape character
 * itself so user input is matched literally.
 */
export function escapeIlikeValue(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
