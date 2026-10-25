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

export type ThemeName = "light" | "dark";

/**
 * Every color the page has in one theme, by name without `--`, as a 6-digit hex value. Names that
 * point at another one (`--card: var(--surface)`) are followed. The legacy shadcn names are
 * declared for `:root` and `.dark` together; the dark theme then takes what `.dark` redefines.
 */
export function resolveColors(css: string, theme: ThemeName): Map<string, string> {
  const declared = new Map([
    ...readDeclarations(readBlock(css, ":root, .dark")),
    ...readDeclarations(readBlock(css, ":root")),
    ...(theme === "dark" ? readDeclarations(readBlock(css, ".dark")) : []),
  ]);

  const follow = (name: string, seen: Set<string>): string | null => {
    const value = declared.get(name);
    if (value === undefined || seen.has(name)) return null;
    const reference = /^var\(--([a-z0-9-]+)\)$/.exec(value);
    if (reference) return follow(reference[1], new Set(seen).add(name));
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  };

  const colors = new Map<string, string>();
  for (const name of declared.keys()) {
    const hex = follow(name, new Set());
    if (hex) colors.set(name, hex);
  }
  return colors;
}
