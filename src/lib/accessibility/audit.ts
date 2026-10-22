import ts from "typescript";

/**
 * VI-F08-S04 (spec R4): checks on the source of the UI that the lint rules of
 * jsx-a11y cannot make. Test support only; nothing in the app imports it.
 * They read text, so they are a floor: the lint rules (eslint.config.mjs) check
 * the labels and the keyboard, and the review in docs/accessibility-review.md
 * records what only a person at a screen can tell.
 */

/** A class that shows where the focus is. */
const FOCUS_CUE =
  /(^|\s)(focus|focus-visible|data-highlighted|has-\[[^\]]*focus-visible[^\]]*\]):(ring|border|outline|shadow|bg)(?!-none|-hidden)/;
/** A class that takes the browser's own outline away. */
const OUTLINE_OFF = /(^|\s)([a-z-]+:)?outline-(none|hidden)(\s|$)/;

/**
 * Class strings that remove the outline and give nothing in its place, so a
 * person using the keyboard cannot see where they are.
 */
export function findHiddenFocus(source: string): string[] {
  const literals = [...source.matchAll(/"([^"\n]*outline-(?:none|hidden)[^"\n]*)"/g)].map((m) => m[1]);

  return literals.filter((classes) => OUTLINE_OFF.test(classes) && !FOCUS_CUE.test(classes));
}

/**
 * A file that shows a field as invalid but has no way to say why: no error
 * message component, no `aria-describedby` and no alert. Generic wrappers that
 * only style `aria-invalid` are not looked at (src/components/ui).
 */
export function hasInvalidWithoutMessage(source: string): boolean {
  return (
    source.includes("aria-invalid") &&
    !/FieldError|aria-describedby|role="alert"/.test(source)
  );
}

/** A file that has a button with only an icon but no name for it. */
export function hasIconButtonWithoutName(source: string): boolean {
  return /size="icon/.test(source) && !/aria-label|sr-only/.test(source);
}

const CONTROL_TAGS = new Set(["input", "Input", "textarea", "Textarea", "select"]);
const LABEL_TAGS = new Set(["label", "Label", "FieldLabel"]);
/** Inputs that have no text field to label, or are labelled by what they sit in. */
const UNLABELLED_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

const attrName = (attr: ts.JsxAttributeLike) =>
  ts.isJsxAttribute(attr) ? attr.name.getText() : null;

export function literalOf(attr: ts.JsxAttribute | undefined): string | null {
  const init = attr?.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteralLike(init.expression)) {
    return init.expression.text;
  }
  return null;
}

/**
 * Form controls with no name a screen reader can read: no `aria-label`, not inside
 * a label, and no `id` that a `htmlFor` in the same file points to. Controls with a
 * spread of props, or an `id` or `htmlFor` computed at run time, are left alone,
 * since the text cannot tell. The lint rules check the other direction (a label with
 * no control).
 */
export function findUnlabelledControls(source: string): string[] {
  const file = ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const targets = new Set<string>();
  let dynamicLabelFor = false;
  const controls: { tag: string; node: ts.Node; attrs: ts.JsxAttributeLike[]; inLabel: boolean }[] = [];

  const visit = (node: ts.Node, inLabel: boolean) => {
    let nextInLabel = inLabel;
    const element = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;

    if (element) {
      const tag = element.tagName.getText();
      const attrs = element.attributes.properties;
      const find = (name: string) =>
        attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && attrName(a) === name);

      if (LABEL_TAGS.has(tag)) {
        const htmlFor = find("htmlFor");
        const value = literalOf(htmlFor);
        if (value !== null) targets.add(value);
        else if (htmlFor) dynamicLabelFor = true;
        if (ts.isJsxElement(node)) nextInLabel = true;
      }
      if (CONTROL_TAGS.has(tag)) controls.push({ tag, node, attrs: [...attrs], inLabel });
    }
    ts.forEachChild(node, (child) => visit(child, nextInLabel));
  };
  visit(file, false);

  return controls
    .filter(({ attrs, inLabel }) => {
      const find = (name: string) =>
        attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && attrName(a) === name);
      const type = literalOf(find("type"));
      if (type && UNLABELLED_TYPES.has(type)) return false;
      if (inLabel || attrs.some((a) => ts.isJsxSpreadAttribute(a))) return false;
      if (find("aria-label") || find("aria-labelledby")) return false;

      const idAttr = find("id");
      const id = literalOf(idAttr);
      if (id !== null && targets.has(id)) return false;
      if ((idAttr && id === null) || dynamicLabelFor) return false;
      return true;
    })
    .map(({ tag, node }) => `<${tag}> at line ${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
}
