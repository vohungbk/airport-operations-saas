/**
 * UI-F01-S02 (spec R8): finds a raw color value in source. Components use token classes
 * (`bg-primary`, `text-muted-foreground`); a color written out belongs in `src/app/globals.css`
 * only. Test support only; nothing in the app imports it.
 */

const RAW_COLOR_PATTERNS: RegExp[] = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgba?\(/,
  /\bhsla?\(/,
  /\boklch\(/,
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-(?:red|green|blue|yellow|gray|slate|zinc|neutral|stone|amber|orange|emerald|sky|white|black)(?:-\d+)?\b/,
  // An inline style that sets a color to a plain word such as "red". `var(...)`, `currentColor`,
  // `inherit`, `transparent` and `none` are not raw colors, and a value built with `${...}` is a
  // class name or other text, not a color.
  /\b(?:color|backgroundColor|background|borderColor|fill|stroke)\s*:\s*["'`](?!currentColor|inherit|transparent|none)[a-zA-Z]+["'`]/,
];

/** The 1-based numbers of the lines that hold a raw color value. */
export function findRawColorLines(source: string): number[] {
  return source
    .split("\n")
    .flatMap((line, index) =>
      RAW_COLOR_PATTERNS.some((pattern) => pattern.test(line)) ? [index + 1] : [],
    );
}
