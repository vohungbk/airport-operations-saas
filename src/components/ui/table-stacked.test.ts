import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
/** How React writes a class name into an attribute: `&`, `>` and `'` are escaped. */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;");

const table = (stacked: boolean) =>
  html(
    createElement(
      Table,
      { stacked },
      createElement(TableHeader, null, createElement(TableRow, null, createElement(TableHead, null, "Serial"))),
      createElement(TableBody, null, createElement(TableRow, null, createElement(TableCell, { "data-label": "Serial" } as never, "SEAT-1"))),
    ),
  );

describe("stacked Table (UI-F06-S02, R10)", () => {
  it("should mark its box as stacked, so a phone gets cards", () => {
    expect(table(true)).toContain('data-stacked=""');
  });

  it("should turn the table, the header and the body into blocks below sm", () => {
    const out = table(true);
    expect(out).toContain("group-data-stacked/table:max-sm:block");
  });

  it("should make each body row a card with a border", () => {
    expect(table(true)).toContain(esc("group-data-stacked/table:max-sm:[&>tr]:border"));
  });

  it("should write the name of the column in front of each cell, from its data-label", () => {
    const out = table(true);
    expect(out).toContain("content-[attr(data-label)]");
    expect(out).toContain('data-label="Serial"');
  });

  it("should hide the heads that do not sort on a phone", () => {
    expect(table(true)).toContain("group-data-stacked/table:max-sm:hidden");
  });

  it("should say Sort by in front of the heads that stay", () => {
    expect(table(true)).toContain(esc("content-['Sort_by']"));
  });

  it("should not mark a plain table as stacked: it is the table it was", () => {
    expect(table(false)).not.toContain('data-stacked=""');
  });

  it("should keep scrolling sideways inside its own box from sm up", () => {
    expect(table(true)).toContain("overflow-x-auto");
  });
});

describe("the roles of a table that is made of blocks", () => {
  it("should write the roles out, since a browser can drop them from a block", () => {
    const out = table(true);
    for (const role of ["table", "rowgroup", "row", "columnheader", "cell"]) expect(out).toContain(`role="${role}"`);
  });
});

describe("SortableTableHead", () => {
  const head = (direction: "asc" | "desc" | null) => html(createElement("table", null, createElement("thead", null, createElement("tr", null, createElement(SortableTableHead, { href: "/seats?sort=status", label: "Status", direction })))));

  it("should be a link to the list sorted by its column", () => {
    const out = head(null);
    expect(out).toContain('href="/seats?sort=status"');
    expect(out).toContain("Status");
  });

  it("should be 44 px high on a touch screen", () => {
    expect(head(null)).toContain("pointer-coarse:min-h-11");
  });

  it.each([
    ["asc", "ascending"],
    ["desc", "descending"],
  ] as const)("should say %s as aria-sort %s, with an arrow", (direction, sort) => {
    const out = head(direction);
    expect(out).toContain(`aria-sort="${sort}"`);
    expect(out).toContain("<svg");
  });

  it("should say nothing about the sort and draw no arrow when the list is sorted by another column", () => {
    const out = head(null);
    expect(out).not.toContain("aria-sort");
    expect(out).not.toContain("<svg");
  });

  it("should stay visible on a phone, where the other heads are hidden", () => {
    const out = head(null);
    expect(out).toContain("group-data-stacked/table:max-sm:block");
    expect(out).not.toContain("group-data-stacked/table:max-sm:hidden");
  });
});
