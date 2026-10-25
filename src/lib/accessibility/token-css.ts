/**
 * Reads `src/app/globals.css` as text for the token tests. Test support only; nothing in the
 * app imports it.
 */

/**
 * The body of the first rule whose selector is exactly `selector`, found by matching braces so
 * a rule nested in an at-rule (the dark theme sits in `@media not print`) is read too.
 */
export function readBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const opening = new RegExp(`^[ \\t]*${escaped} \\{`, "m").exec(css);
  if (!opening) return "";

  const start = opening.index + opening[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i);
  }
  return css.slice(start);
}

/** Custom property declarations of a block, name without `--`. */
export function readDeclarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/^\s*--([a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
  );
}
