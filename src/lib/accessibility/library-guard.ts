import ts from "typescript";

import { literalOf } from "@/lib/accessibility/audit";

/**
 * UI-F03-S05 (spec R13, E1): a screen uses the parts of the library, so a change to a part is made
 * in one place, and a part that is missing is added to the library first. This finds a native
 * `button`, `input`, `select` or `textarea` written in a screen. An `<input type="hidden">` is not
 * a control a person uses, so it is allowed. Test support only; nothing in the app imports it.
 */
const NATIVE_CONTROLS = new Set(["button", "input", "select", "textarea"]);

export function findNativeControls(source: string): string[] {
  const file = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  const visit = (node: ts.Node) => {
    const element = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (element && NATIVE_CONTROLS.has(element.tagName.getText())) {
      const type = element.attributes.properties.find(
        (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === "type",
      );
      if (!(element.tagName.getText() === "input" && literalOf(type) === "hidden")) {
        found.push(element.tagName.getText());
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);

  return found;
}

/** True for a path under a directory called `gallery`, or a nav address that points at one. */
export function isGalleryPath(path: string): boolean {
  return /(^|[\\/])gallery([\\/]|$)/i.test(path);
}
