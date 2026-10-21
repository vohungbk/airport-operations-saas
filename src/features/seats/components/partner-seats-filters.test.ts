import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerSeatsFilters } from "@/features/seats/components/partner-seats-filters";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

const render = (raw: Record<string, string> = {}) =>
  renderToStaticMarkup(
    createElement(PartnerSeatsFilters, { query: partnerSeatsQuerySchema.parse(raw) }),
  );

describe("PartnerSeatsFilters", () => {
  it("should be a GET form to the partner seats view, with a search and a status", () => {
    const html = render();

    expect(html).toContain('method="get"');
    expect(html).toContain('action="/partner/seats"');
    expect(html).toContain('name="q"');
    expect(html).toContain('name="status"');
  });

  it("should offer no airport, category or partner filter", () => {
    const html = render();

    for (const name of ["airport_id", "category_id", "partner_id"]) {
      expect(html).not.toContain(`name="${name}"`);
    }
  });

  it("should show Clear only when a search or a status is active", () => {
    expect(render()).not.toContain("Clear");
    expect(render({ q: "cs" })).toContain("Clear");
    expect(render({ status: "available" })).toContain("Clear");
  });

  it("should keep the sort when a new search is submitted", () => {
    const html = render({ sort: "status", order: "desc" });

    expect(html).toContain('name="sort" value="status"');
    expect(html).toContain('name="order" value="desc"');
  });
});
