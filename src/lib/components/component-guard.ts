import ts from "typescript";

/**
 * UI-F04-S05 (spec R9, R12, R13): checks on the source of the domain components that keep a part
 * from misleading or leaking. They read the text of a file, so they are a floor, not proof: the
 * server checks of role and row level security stay the real boundary. Test support only; nothing
 * in the app imports it.
 */

const parse = (source: string) => ts.createSourceFile("x.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

const attrOf = (element: ts.JsxOpeningLikeElement, name: string) =>
  element.attributes.properties.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name);

/** Every module a file imports or re-exports from. */
export function moduleSpecifiers(source: string): string[] {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    }
  });
  return found;
}

/**
 * R9: a part takes its data as props. These modules read data, so a part that imports one can show
 * what nobody gave it: the features (their queries), the database client, the demo data, and the
 * request headers.
 */
const DATA_SOURCE = /^(@\/features(\/|$)|@\/lib\/supabase(\/|$)|@\/lib\/demo(\/|$)|next\/headers$)/;

export function findDataImports(source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => DATA_SOURCE.test(specifier));
}

/** R9: a call that makes a value up or reads one from outside: the network, the clock, chance. */
export function findLiveDataCalls(source: string): string[] {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText();
      if (callee === "fetch" || callee === "Date.now" || callee === "Math.random") found.push(`${callee}()`);
    }
    if (ts.isNewExpression(node) && node.expression.getText() === "Date") found.push("new Date()");
  });
  return found;
}

/** A number, an amount or a percent written as the only content of a piece of text. */
const BARE_NUMBER = /^[-+]?\d[\d.,]*%?$/;

/**
 * R9: a figure written into the markup (`{42}`, `>12.50<`) is a hardcoded value shown as live.
 * Attributes such as `aria-valuemax={100}` are not content and are not looked at.
 */
export function findBareNumbers(source: string): string[] {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if (ts.isJsxText(node) && BARE_NUMBER.test(node.text.trim())) found.push(node.text.trim());
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) {
      const expression = node.expression;
      const literal = ts.isPrefixUnaryExpression(expression) ? expression.operand : expression;
      if (ts.isNumericLiteral(literal) || (ts.isStringLiteralLike(literal) && BARE_NUMBER.test(literal.text.trim()))) {
        found.push(expression.getText());
      }
    }
  });
  return found;
}

/** The variants of `Badge` and `Alert` that mean nothing about a state. */
const NEUTRAL_VARIANTS = new Set(["default", "outline", "secondary", "ghost", "link", "muted"]);
/** A text color or fill that tells a state. */
const STATE_COLOR = /(^|[\s"'`:])(text|bg)-(success|danger|warning|info)(-fg|-bg)?(?![\w-])/;
const STATE_ELEMENTS = new Set(["Badge", "Alert"]);

const isIcon = (tag: string) => tag === "svg" || /Icon$/.test(tag) || tag === "Icon";

function hasIconAndText(element: ts.JsxElement): boolean {
  let icon = false;
  let text = false;
  walk(element, (node) => {
    if (node === element) return;
    const tag = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : null;
    if (tag && isIcon(tag)) icon = true;
    if (ts.isJsxText(node) && node.text.trim() !== "") text = true;
    if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent)) text = true;
  });
  return icon && text;
}

/**
 * R12: an element that tells a state by color must also carry an icon and text. This finds a
 * `Badge` or `Alert` with a state variant (or one the check cannot read, which counts as a state),
 * and any other element with a state color class, that does not.
 */
export function findStateWithoutCue(source: string): string[] {
  const found: string[] = [];
  walk(parse(source), (node) => {
    if (!ts.isJsxElement(node)) return;
    const opening = node.openingElement;
    const tag = opening.tagName.getText();
    const variant = attrOf(opening, "variant");
    const className = attrOf(opening, "className");
    const literal = variant?.initializer && ts.isStringLiteral(variant.initializer) ? variant.initializer.text : null;

    const isStateElement = STATE_ELEMENTS.has(tag) && variant !== undefined && !(literal !== null && NEUTRAL_VARIANTS.has(literal));
    const hasStateColor = !STATE_ELEMENTS.has(tag) && className !== undefined && STATE_COLOR.test(className.getText());

    if ((isStateElement || hasStateColor) && !hasIconAndText(node)) found.push(`<${tag}> ${(variant ?? className)?.getText()}`);
  });
  return found;
}

/**
 * R13: parts that only staff may use. A module whose path names one of these must not reach a
 * partner screen or a shared part. Extend the pattern when another internal-only part appears.
 */
export const INTERNAL_ONLY_MODULE = /adjustment|commercial-terms|simulator/i;

export function findInternalOnlyImports(source: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => INTERNAL_ONLY_MODULE.test(specifier));
}

/**
 * R13: a shared part shows data and takes callbacks; it does not submit anything. A form, a server
 * action import or a `"use server"` file would be an action that a partner screen could reach.
 */
export function findMutationSurface(source: string): string[] {
  const found: string[] = [];
  const file = parse(source);
  walk(file, (node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && /^(form|Form)$/.test(node.tagName.getText())) found.push("<form>");
    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use server") found.push('"use server"');
  });
  for (const specifier of moduleSpecifiers(source)) {
    if (/(^|\/)actions(\/|$)/.test(specifier)) found.push(`import ${specifier}`);
  }
  return found;
}
