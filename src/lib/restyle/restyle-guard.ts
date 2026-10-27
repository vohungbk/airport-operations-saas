import ts from "typescript";

/**
 * UI-F06-S01 (spec R10): a link on a restyled page is a part of the library, so it is at least 44 px
 * high on a touch screen. This finds a link written out as plain text with an underline (`<Link>` or
 * `<a>`) instead of `TextLink`; a `Link` that takes the look of a button with `buttonVariants` is fine.
 * Test support only; nothing in the app imports it.
 */
export function findPlainLinks(source: string): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      const attr = (name: string) => node.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name);

      if (tag === "a") found.push("<a>");
      if (tag === "Link" && !attr("className")?.getText().includes("buttonVariants(")) found.push(`<Link ${attr("href")?.getText() ?? ""}>`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return found;
}
