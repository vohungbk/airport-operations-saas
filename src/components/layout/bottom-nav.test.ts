import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const LAYOUT_DIR = join(process.cwd(), "src", "components", "layout");
const read = (name: string) => readFileSync(join(LAYOUT_DIR, name), "utf8");

describe("bottom navigation", () => {
  const bar = read("bottom-nav.tsx");

  it("should be a labelled navigation fixed to the bottom, on phones only and off the printed page", () => {
    expect(bar).toContain('aria-label="Primary"');
    expect(bar).toMatch(/className="fixed inset-x-0 bottom-0 [^"]*md:hidden print:hidden"/);
  });

  it("should be at least 68 px high, growing with the home indicator of a phone", () => {
    expect(bar).toContain("min-h-17");
    expect(bar).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("should make every slot a touch target of at least 44 px that shares the width", () => {
    expect(bar).toContain("min-h-11");
    expect(bar).toMatch(/SLOT_CLASS =\s*"[^"]*flex-1/);
  });

  it("should mark the current item with the page state, a bar and a heavier label", () => {
    expect(bar).toContain('aria-current={isActive ? "page" : undefined}');
    expect(bar).toContain("font-semibold");
    expect(bar).toContain("before:bg-primary-foreground");
  });

  it("should show an icon and a label in every slot, in the caption size, over at most two lines", () => {
    expect(bar).toContain('<Icon className="size-5 shrink-0" aria-hidden="true" />');
    expect(bar).toContain('<span className="line-clamp-2 max-w-full text-center text-caption');
    expect(bar).toContain("line-clamp-2");
    expect(bar).toContain("{item.label}");
  });

  it("should end with the More slot, which gets the items that did not fit", () => {
    expect(bar).toMatch(/<MoreSheet items=\{moreItems\}/);
  });
});

describe("more sheet", () => {
  const sheet = read("more-sheet.tsx");

  it("should sit at the bottom of the screen and only on phones", () => {
    expect(sheet).toContain("bottom-0");
    expect(sheet).toContain("md:hidden");
  });

  it("should write the label of the More slot in the caption size, as the other slots do", () => {
    expect(sheet).toContain('<span className="text-caption">More</span>');
  });

  it("should list the other items as links and close when one is chosen", () => {
    expect(sheet).toContain('<nav aria-label="More">');
    expect(sheet).toContain('closest("a")');
    expect(sheet).toContain("close()");
  });

  it("should show the name, the role and the email of the user", () => {
    expect(sheet).toContain("{user.full_name}");
    expect(sheet).toContain("{user.role_label}");
    expect(sheet).toContain("{user.email}");
  });

  it("should leave the list out when there are no other items", () => {
    expect(sheet).toContain("items.length > 0 &&");
  });
});

describe("app bar", () => {
  const appBar = read("mobile-app-bar.tsx");

  it("should show the title and, only when there is a page above, a back arrow named Back", () => {
    expect(appBar).toContain("{backHref && (");
    expect(appBar).toContain('aria-label="Back"');
    expect(appBar).toContain("{title}");
  });

  it("should not be a heading, since the page has its own", () => {
    expect(appBar).not.toMatch(/<h[1-6]/);
  });

  it("should give the arrow a touch target of at least 44 px", () => {
    expect(appBar).toContain("size-11");
  });
});
