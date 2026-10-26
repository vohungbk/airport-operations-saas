import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Pagination } from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetTitle, sheetVariants } from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const href = (page: number) => `/items?page=${page}`;

describe("Pagination", () => {
  it("should mark the current page and link the others", () => {
    const out = html(createElement(Pagination, { page: 2, totalPages: 5, buildHref: href }));
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toContain('href="/items?page=3"');
  });

  it("should disable Previous on the first page", () => {
    const out = html(createElement(Pagination, { page: 1, totalPages: 5, buildHref: href }));
    expect(out).toMatch(/aria-label="Previous page"[^>]*aria-disabled="true"/);
    expect(out).not.toMatch(/<a[^>]*aria-label="Previous page"/);
  });

  it("should disable Next on the last page", () => {
    const out = html(createElement(Pagination, { page: 5, totalPages: 5, buildHref: href }));
    expect(out).toMatch(/aria-label="Next page"[^>]*aria-disabled="true"/);
  });

  it("should wrap instead of overflowing when there are many pages", () => {
    const out = html(createElement(Pagination, { page: 10, totalPages: 50, buildHref: href }));
    expect(out).toContain("flex-wrap");
    expect(out).toContain("…");
  });
});

describe("Stepper", () => {
  const steps = [
    { label: "Details", status: "complete" as const },
    { label: "Review", status: "current" as const },
    { label: "Confirm", status: "upcoming" as const },
  ];

  it("should mark only the current step with aria-current", () => {
    const out = html(createElement(Stepper, { steps }));
    expect(out.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("should say a step is in error to assistive technology", () => {
    const out = html(createElement(Stepper, { steps: [{ label: "Payment", status: "error" }] }));
    expect(out).toContain("(error)");
    expect(out).toContain('data-status="error"');
  });

  it("should cut a long label and keep it whole in the title", () => {
    const label = "A very long step name that cannot fit in its column";
    const out = html(createElement(Stepper, { steps: [{ label, status: "upcoming" }] }));
    expect(out).toContain("truncate");
    expect(out).toContain(`title="${label}"`);
  });
});

describe("Tabs", () => {
  const tabs = createElement(
    Tabs,
    { defaultValue: "a" },
    createElement(TabsList, null, createElement(TabsTrigger, { value: "a" }, "First"), createElement(TabsTrigger, { value: "b", disabled: true }, "Second")),
    createElement(TabsContent, { value: "a" }, "Panel A"),
  );

  it("should select the default tab and show its panel", () => {
    const out = html(tabs);
    expect(out).toContain('aria-selected="true"');
    expect(out).toContain("Panel A");
  });

  it("should render a disabled tab", () => {
    expect(html(tabs)).toMatch(/disabled=""[^>]*>Second|aria-disabled="true"[^>]*>Second/);
  });

  it("should scroll the list sideways instead of overflowing the page", () => {
    expect(html(tabs)).toContain("overflow-x-auto");
  });
});

describe("Sheet", () => {
  it("should render nothing until it is open", () => {
    const out = html(createElement(Sheet, null, createElement(SheetContent, null, createElement(SheetTitle, null, "Filters"))));
    expect(out).not.toContain("Filters");
  });

  it("should place each side against its own edge of the screen", () => {
    expect(sheetVariants({ side: "right" })).toContain("right-0");
    expect(sheetVariants({ side: "left" })).toContain("left-0");
    expect(sheetVariants({ side: "top" })).toContain("top-0");
    expect(sheetVariants({ side: "bottom" })).toContain("bottom-0");
  });

  it("should never be wider than the screen", () => {
    expect(sheetVariants({ side: "right" })).toContain("max-w-sm");
    expect(sheetVariants({ side: "bottom" })).toContain("max-h-[80dvh]");
  });
});
