import { describe, expect, it } from "vitest";

import { findRawColorLines } from "./raw-colors";

describe("findRawColorLines", () => {
  it.each([
    ['className="bg-[#0F4C81]"', "a hex value in an arbitrary class"],
    ['const c = "#fff";', "a short hex value"],
    ["fill: rgb(0 0 0)", "rgb()"],
    ["color: hsl(210 40% 50%)", "hsl()"],
    ["x = oklch(0.5 0.1 250)", "oklch()"],
    ['className="text-white"', "a Tailwind palette class"],
    ['className="bg-red-500"', "a numbered palette class"],
    ['<div style={{ color: "red" }} />', "an inline style color"],
    ["const s = { backgroundColor: 'blue' }", "an inline background color"],
  ])("should flag %s (%s)", (line) => {
    expect(findRawColorLines(line)).toEqual([1]);
  });

  it.each([
    ['className="bg-primary text-primary-foreground"', "token classes"],
    ['className="bg-success-bg text-success-fg"', "design token classes"],
    ['style={{ color: "var(--text)" }}', "an inline style that uses a token"],
    ['style={{ color: "currentColor" }}', "currentColor"],
    ['className="bg-transparent"', "transparent"],
    ['<a href="#main-content">', "a page anchor"],
  ])("should not flag %s (%s)", (line) => {
    expect(findRawColorLines(line)).toEqual([]);
  });

  it("should give the line numbers of every match", () => {
    const source = ['const a = "ok";', 'const b = "#123456";', "const c = 1;", 'const d = "rgb(1 2 3)";'].join("\n");

    expect(findRawColorLines(source)).toEqual([2, 4]);
  });
});
