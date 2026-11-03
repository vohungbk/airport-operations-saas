import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BookingsListPendingProvider,
  BookingsResults,
} from "@/features/bookings/components/bookings-list-pending";
import { BookingsTableSkeleton } from "@/features/bookings/components/bookings-table-skeleton";
import { bookingsQuerySchema } from "@/features/bookings/schemas/bookings-query.schema";

const QUERY = bookingsQuerySchema.parse({});

describe("BookingsResults", () => {
  it("should show the list, and no skeleton, when nothing is loading", () => {
    const html = renderToStaticMarkup(
      createElement(
        BookingsListPendingProvider,
        null,
        createElement(BookingsResults, { query: QUERY }, createElement("p", null, "THE_LIST")),
      ),
    );

    expect(html).toContain("THE_LIST");
    expect(html).not.toContain("Loading bookings");
  });

  it("should show the list outside a provider", () => {
    const html = renderToStaticMarkup(
      createElement(BookingsResults, { query: QUERY }, createElement("p", null, "THE_LIST")),
    );

    expect(html).toContain("THE_LIST");
  });
});

describe("BookingsTableSkeleton", () => {
  it("should announce loading once and show 10 rows of 5 placeholder bars, one per column", () => {
    const html = renderToStaticMarkup(createElement(BookingsTableSkeleton, { query: QUERY }));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading bookings"');
    expect(html.match(/data-slot="skeleton"/g)).toHaveLength(50);
  });

  it("should keep the table header, with its labels, and put the placeholders in the body only", () => {
    const html = renderToStaticMarkup(createElement(BookingsTableSkeleton, { query: QUERY }));
    const [header, body] = html.split("<tbody");

    for (const label of ["Booking", "Partner", "Pickup", "Flight", "Status"]) {
      expect(header).toContain(label);
    }
    expect(header).not.toContain('data-slot="skeleton"');
    expect(body).toContain('data-slot="skeleton"');
  });
});
