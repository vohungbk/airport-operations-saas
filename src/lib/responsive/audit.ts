import ts from "typescript";

import { literalOf } from "@/lib/accessibility/audit";

/**
 * VI-F08-S05 (spec R5): checks on the source of the UI for what makes a layout
 * break on a narrow screen. Test support only; nothing in the app imports it.
 * They read text, so they are a floor: how a page looks at a size is recorded
 * from the screen in docs/responsive-review.md.
 */

/** From this width (in Tailwind spacing units, 4 px each) a fixed width can be wider than a phone's content. */
const WIDE_UNITS = 64;
const WIDE_PIXELS = WIDE_UNITS * 4;

/**
 * Class strings with a fixed width of 256 px or more that applies from the
 * smallest screen up: `w-72`, `w-[300px]`. A width behind a breakpoint
 * (`sm:w-72`) is fine, and so is one that is capped (`max-w-[85vw]`) or on an
 * element that is hidden until a breakpoint (`hidden w-64 md:flex`).
 */
export function findFixedWideWidths(source: string): string[] {
  const literals = [...source.matchAll(/"([^"\n]*\bw-[^"\n]*)"/g)].map((m) => m[1]);

  return literals.filter((classes) => {
    if (/(^|\s)max-w-/.test(classes) || /(^|\s)hidden(\s|$)/.test(classes)) return false;

    return classes.split(/\s+/).some((token) => {
      const units = /^w-(\d+)$/.exec(token);
      if (units) return Number(units[1]) >= WIDE_UNITS;
      const pixels = /^w-\[(\d+)px\]$/.exec(token);
      return pixels ? Number(pixels[1]) >= WIDE_PIXELS : false;
    });
  });
}

/**
 * A raw `<table>`. Tables go through the shared Table component, which puts the
 * table in a box that scrolls sideways, so a wide table never widens the page.
 */
export function hasRawTable(source: string): boolean {
  return /<table\b/.test(source);
}

/** A viewport setting that stops the person from zooming. */
export function blocksZoom(source: string): boolean {
  return /user-scalable\s*[=:]\s*["']?(no|0)|userScalable\s*:\s*false|maximum-scale|maximumScale/i.test(source);
}

/**
 * Search boxes (an `Input` or `input` whose `aria-label` starts with "Search")
 * that keep their own width on a narrow screen: the box must grow and shrink with
 * its row (`flex-1` or `w-full`) and have no fixed width that applies from the
 * smallest screen. A box with a width of its own widens the whole page when the
 * screen is narrower than the box and the button beside it.
 */
export function findInflexibleSearchInputs(source: string): string[] {
  const file = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  const visit = (node: ts.Node) => {
    const element = ts.isJsxSelfClosingElement(node) ? node : ts.isJsxElement(node) ? node.openingElement : null;
    if (element && ["Input", "input"].includes(element.tagName.getText())) {
      const attr = (name: string) =>
        element.attributes.properties.find(
          (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name,
        );
      const label = literalOf(attr("aria-label"));

      if (label?.startsWith("Search")) {
        const tokens = (literalOf(attr("className")) ?? "").split(/\s+/);
        const grows = tokens.includes("flex-1") || tokens.includes("w-full");
        const fixed = tokens.some((t) => /^w-(\d+|\[\d+px\])$/.test(t));
        if (!grows || fixed) {
          found.push(`"${label}" at line ${file.getLineAndCharacterOfPosition(element.getStart()).line + 1}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return found;
}
