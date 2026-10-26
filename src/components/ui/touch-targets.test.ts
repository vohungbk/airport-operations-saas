import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const read = (name: string) => readFileSync(join(process.cwd(), "src", "components", "ui", name), "utf8");
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

/**
 * UI-F03-S05 (spec R9): on a touch screen (`pointer: coarse`) every part a finger presses is at
 * least 44 px (`11` = 2.75 rem). A mouse keeps the compact size of the design.
 */
describe("touch targets", () => {
  it.each(["default", "xs", "sm", "lg"] as const)("should give a %s button 44 px of height on a touch screen", (size) => {
    expect(html(createElement(Button, { size }))).toContain("pointer-coarse:min-h-11");
  });

  it.each(["icon", "icon-xs", "icon-sm", "icon-lg"] as const)("should give a %s button 44 px by 44 px on a touch screen", (size) => {
    expect(html(createElement(Button, { size }))).toContain("pointer-coarse:size-11");
  });

  it("should give an input 44 px of height on a touch screen", () => {
    expect(html(createElement(Input, null))).toContain("pointer-coarse:h-11");
  });

  it.each([
    ["select.tsx", "pointer-coarse:data-[size=default]:h-11"],
    ["select.tsx", "pointer-coarse:min-h-11"],
    ["combobox.tsx", "pointer-coarse:h-11"],
    ["combobox.tsx", "pointer-coarse:min-h-11"],
    ["date-picker.tsx", "pointer-coarse:h-11"],
    ["tabs.tsx", "pointer-coarse:min-h-11"],
    ["dropdown-menu.tsx", "pointer-coarse:min-h-11"],
    ["calendar.tsx", "pointer-coarse:min-h-11"],
  ])("should give %s a target of 44 px: %s", (file, cls) => {
    expect(read(file)).toContain(cls);
  });

  it.each(["checkbox.tsx", "radio-group.tsx", "switch.tsx"])(
    "should widen the hit area of %s to 44 px without changing how it looks",
    (file) => {
      const text = read(file);
      expect(text).toContain("pointer-coarse:after:size-11");
      expect(text).toContain("relative");
    },
  );

  it("should not make a part taller than the design for a mouse", () => {
    const out = html(createElement(Button, null));
    expect(out).toContain("min-h-8");
    expect(html(createElement(Input, null))).toContain("h-8");
  });
});
