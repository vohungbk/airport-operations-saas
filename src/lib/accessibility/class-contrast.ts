import { TEXT_MIN_RATIO, contrastRatio } from "./contrast";
import type { ThemeName } from "./token-css";

/**
 * UI-F01-S05 (spec R10): the text a component draws must be readable in both themes. This reads
 * the Tailwind classes written in source (`bg-success-bg text-success-fg`) and checks each
 * text color against the background it sits on. Test support only; nothing in the app imports it.
 *
 * What it can see: a class string written out in a literal. What it cannot: a class built at run
 * time from pieces, a class that is not a color (`text-sm`), and states such as `hover:`.
 */

/** Where text without a background of its own is drawn: the page, a card, a popover. */
const SURFACES_FOR_PLAIN_TEXT = ["background", "card", "popover"];

export interface ClassContrastFinding {
  theme: ThemeName;
  classes: string;
  text: string;
  background: string;
  ratio: number;
}

interface ColorClass {
  token: string;
  alpha: number;
}

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** `top` drawn at `alpha` over `below`, as a hex color. */
export function blend(top: string, below: string, alpha: number): string {
  const [t, b] = [toRgb(top), toRgb(below)];
  const mixed = t.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** The background and text color classes that apply in `theme`; `dark:` ones count in Dark only. */
function colorClasses(classes: string, colors: Map<string, string>, theme: ThemeName) {
  const found: { bg?: ColorClass; text?: ColorClass } = {};

  for (const word of classes.split(/\s+/)) {
    const match = /^(dark:)?(bg|text)-([a-z][a-z0-9-]*)(?:\/(\d{1,3}))?$/.exec(word);
    if (!match) continue;
    const [, darkOnly, kind, token, percent] = match;
    if ((darkOnly && theme === "light") || !colors.has(token)) continue;
    found[kind as "bg" | "text"] = { token, alpha: percent ? Number(percent) / 100 : 1 };
  }

  return found;
}

/** Every class literal in `source` that sets a text color, as the classes it holds. */
function classLiterals(source: string): string[] {
  return [...source.matchAll(/(["'`])([^"'`\n]*\b(?:bg|text)-[^"'`\n]*)\1/g)].map((m) => m[2]);
}

/** The text colors in `source` that are below `minimum`:1 on their background in `theme`. */
export function findLowContrastClasses(
  source: string,
  colors: Map<string, string>,
  theme: ThemeName,
  minimum = TEXT_MIN_RATIO,
): ClassContrastFinding[] {
  const page = colors.get("background");
  if (!page) throw new Error("Token --background is not defined as a color");

  return classLiterals(source).flatMap((classes) => {
    const { bg, text } = colorClasses(classes, colors, theme);
    if (!text) return [];

    const backgrounds = bg
      ? [{ name: bg.token, hex: blend(colors.get(bg.token)!, page, bg.alpha) }]
      : SURFACES_FOR_PLAIN_TEXT.flatMap((name) =>
          colors.has(name) ? [{ name, hex: colors.get(name)! }] : [],
        );

    return backgrounds.flatMap(({ name, hex }) => {
      const drawn = blend(colors.get(text.token)!, hex, text.alpha);
      const ratio = contrastRatio(drawn, hex);
      return ratio < minimum
        ? [{ theme, classes, text: `text-${text.token}`, background: `bg-${name}`, ratio }]
        : [];
    });
  });
}
