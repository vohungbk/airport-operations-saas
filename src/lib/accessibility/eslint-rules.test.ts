import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/**
 * VI-F08-S04 (spec R4): the accessibility rules of eslint.config.mjs bite. They
 * check a label with no control; a control with no label is checked by
 * findUnlabelledControls in accessibility.test.ts. A
 * component with a defect is linted from text, with the real config, and must be
 * reported; the same component made right must not be. If a rule is switched off
 * or the component mapping breaks, the lint gate would go on passing, and this
 * is what shows it.
 */
const eslint = new ESLint({ cwd: process.cwd() });

async function rulesReported(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: "src/features/example/example.tsx" });

  return result.messages.map((message) => message.ruleId ?? "").filter((id) => id.startsWith("jsx-a11y/"));
}

describe("accessibility lint rules (VI-F08-S04)", () => {
  it.each([
    ["a label with no control", `export const A = () => <div><label>Result</label><div /></div>;`, "jsx-a11y/label-has-associated-control"],
    ["a field label with no control (the group of radios that was fixed)", `export const A = () => <div><FieldLabel>Result</FieldLabel><div><label><input type="radio" /> Yes</label></div></div>;`, "jsx-a11y/label-has-associated-control"],
    ["a div that can be clicked but not reached with the keyboard", `export const A = ({ f }: { f: () => void }) => <div onClick={f}>Open</div>;`, "jsx-a11y/click-events-have-key-events"],
    ["a positive tab index", `export const A = () => <button tabIndex={3}>Go</button>;`, "jsx-a11y/tabindex-no-positive"],
    ["autofocus", `export const A = () => <input aria-label="Name" autoFocus />;`, "jsx-a11y/no-autofocus"],
    ["a link with no address", `export const A = () => <a onClick={() => {}}>Open</a>;`, "jsx-a11y/anchor-is-valid"],
    ["a heading with no text", `export const A = () => <h2 />;`, "jsx-a11y/heading-has-content"],
  ])("should report %s", async (_name, code, rule) => {
    expect(await rulesReported(code)).toContain(rule);
  });

  it.each([
    ["an input with a label", `export const A = () => <div><label htmlFor="a">Name</label><input id="a" /></div>;`],
    ["an input inside its label", `export const A = () => <label>Name <input /></label>;`],
    ["an input with a name of its own", `export const A = () => <input aria-label="Search" />;`],
    ["a label that points to a control by id", `export const A = () => <div><FieldLabel htmlFor="a">Name</FieldLabel><input id="a" /></div>;`],
    ["a button", `export const A = ({ f }: { f: () => void }) => <button onClick={f}>Open</button>;`],
  ])("should accept %s", async (_name, code) => {
    expect(await rulesReported(code)).toEqual([]);
  });
});
