import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerSeatsPagination } from "@/features/seats/components/partner-seats-pagination";
import { partnerSeatsQuerySchema } from "@/features/seats/schemas/partner-seats-query.schema";

const render = (raw: Record<string, string>, total: number) =>
  renderToStaticMarkup(
    createElement(PartnerSeatsPagination, {
      query: partnerSeatsQuerySchema.parse(raw),
      total,
    }),
  );

describe("PartnerSeatsPagination", () => {
  it("should say which page it is and how many seats there are", () => {
    expect(render({}, 45)).toContain("Page 1 of 3 (45 seats)");
    expect(render({}, 1)).toContain("(1 seat)");
  });

  it("should offer only Next on the first page, and only Previous on the last", () => {
    const first = render({}, 45);
    const last = render({ page: "3" }, 45);

    expect(first).toContain('href="/partner/seats?');
    expect(first.match(/<a /g)).toHaveLength(1);
    expect(first).toContain("Next");
    expect(last.match(/<a /g)).toHaveLength(1);
    expect(last).toContain("Previous");
  });

  it("should offer both in the middle, and keep every link inside the partner area", () => {
    const html = render({ page: "2" }, 45);

    expect(html.match(/<a /g)).toHaveLength(2);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      expect(href).toMatch(/^\/partner\/seats\?/);
    }
  });
});
