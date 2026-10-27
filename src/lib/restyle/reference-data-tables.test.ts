import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AirportsTable } from "@/features/airports/components/airports-table";
import { PartnersTable } from "@/features/partners/components/partners-table";
import { SeatCategoriesTable } from "@/features/seat-categories/components/seat-categories-table";
import { SeatsTable } from "@/features/seats/components/seats-table";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
/** How React writes a class name into an attribute: `&`, `>` and `'` are escaped. */
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;");

const LONG = "Northern Region Airport Ground Handling and Child Seat Rental Services Joint Venture Limited";
const NO_BREAK = "X".repeat(80);

const partnersQuery = { sort: "name", order: "asc", page: 1, page_size: 20 };
const partner = (name: string) => ({
  id: "p-1",
  name,
  code: "DMO",
  status: "active",
  created_at: "2026-08-01T00:00:00Z",
  contact_email: "ops@example.test",
});

const airport = (name: string) => ({ id: "a-1", code: "DXB", name, city: "Dubai", country: "AE", timezone: "Asia/Dubai" });
const category = (name: string) => ({
  id: "c-1",
  name,
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
  is_active: true,
});
const seat = (serial: string) => ({
  id: "s-1",
  public_token: "d65193a1-bd16-5a78-fd25-e4a1428026e6",
  serial_number: serial,
  status: "available",
  created_at: "2026-08-01T00:00:00Z",
  category: { id: "c", name: "Convertible" },
  airport: { id: "a", code: "DXB", name: "Dubai" },
});

const TABLES = {
  partners: (name: string) => html(createElement(PartnersTable, { partners: [partner(name)], query: partnersQuery } as never)),
  airports: (name: string) =>
    html(createElement(AirportsTable, { airports: [airport(name)], query: { sort: "code", order: "asc", page: 1, page_size: 20 } } as never)),
  "seat categories": (name: string) =>
    html(createElement(SeatCategoriesTable, { seatCategories: [category(name)], query: { sort: "name", order: "asc", page: 1, page_size: 20 } } as never)),
  seats: (name: string) =>
    html(createElement(SeatsTable, { seats: [seat(name)], query: { sort: "created_at", order: "desc", page: 1, page_size: 20 } } as never)),
};

describe.each(Object.keys(TABLES))("%s table (UI-F06-S02, R10, E1)", (name) => {
  const draw = (label = "Name") => TABLES[name as keyof typeof TABLES](label);

  it("should become cards on a phone", () => {
    expect(draw()).toContain('data-stacked=""');
  });

  it("should label every cell with its column, so the card says what each value is", () => {
    const out = draw();
    const cells = out.match(/<td /g)?.length ?? 0;
    const labelled = out.match(/<td [^>]*data-label="[^"]+"/g)?.length ?? 0;

    expect(cells).toBeGreaterThan(3);
    expect(labelled).toBe(cells);
  });

  it("should sort by a link in the header, 44 px high on a touch screen, with the direction said", () => {
    const out = draw();
    expect(out).toContain("pointer-coarse:min-h-11");
    expect(out).toMatch(/aria-sort="(ascending|descending)"/);
  });

  it("should open the record by a link that is 44 px high on a touch screen and says what it opens", () => {
    const out = draw("Dubai Hub");
    expect(out).toMatch(/<a [^>]*aria-label="View [^"]+"[^>]*>View<\/a>/);
    expect(out).toContain('data-slot="text-link"');
  });

  it("should keep a very long name whole, so it can wrap in a card instead of being cut", () => {
    expect(draw(LONG)).toContain(LONG);
  });

  it("should let a card break a name with no spaces, not push the page sideways", () => {
    const out = draw(NO_BREAK);
    expect(out).toContain(NO_BREAK);
    expect(out).toContain(esc("group-data-stacked/table:max-sm:[&_td]:break-words"));
  });
});

describe("the seats table", () => {
  const out = TABLES.seats("SEAT-0001");

  it("should cut the public token in a table and give it whole in the title", () => {
    expect(out).toContain("truncate");
    expect(out).toContain('title="d65193a1-bd16-5a78-fd25-e4a1428026e6"');
  });

  it("should let a card break the token instead of cutting it", () => {
    expect(out).toContain("max-sm:break-all");
    expect(out).toContain("max-sm:max-w-none");
  });
});
