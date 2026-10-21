import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerSeatsTable } from "@/features/seats/components/partner-seats-table";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

const seats = [
  {
    id: "s1",
    serial_number: "CS-0001",
    status: "available" as const,
    category: { name: "Toddler" },
    airport: { code: "DXB", name: "Dubai" },
  },
  {
    id: "s2",
    serial_number: "CS-0002",
    status: "quarantine" as const,
    category: null,
    airport: null,
  },
];

const html = renderToStaticMarkup(
  createElement(PartnerSeatsTable, { seats, query: partnerSeatsQuerySchema.parse({}) }),
);

describe("PartnerSeatsTable", () => {
  it("should show the serial, category, airport and status of each seat", () => {
    expect(html).toContain("CS-0001");
    expect(html).toContain("Toddler");
    expect(html).toContain("DXB");
    expect(html).toContain("Available");
    expect(html).toContain("Quarantine");
  });

  it("should show a dash, not a blank or a made-up value, when the category or airport is hidden", () => {
    expect(html).toContain(">-<");
  });

  it("should be read-only: no link to a seat, no action and no public token column", () => {
    expect(html).not.toContain("/seats/");
    expect(html).not.toContain("Actions");
    expect(html).not.toContain("Public token");
    expect(html).not.toContain(">View<");
  });

  it("should let the serial and status columns be sorted with links inside the partner area", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

    expect(hrefs.length).toBe(2);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/partner\/seats\?/);
    }
  });
});
