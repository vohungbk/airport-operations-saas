import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/bookings",
}));

import { BookingEventsTimeline } from "@/features/bookings/components/booking-events-timeline";
import { BookingsFilters } from "@/features/bookings/components/bookings-filters";
import { BookingsPagination } from "@/features/bookings/components/bookings-pagination";
import { BookingsTable } from "@/features/bookings/components/bookings-table";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const LONG =
  "Northern Region Airport Ground Handling and Child Seat Rental Services Joint Venture Limited";
const NO_BREAK = "X".repeat(80);

const query = {
  sort: "pickup_at",
  order: "desc",
  page: 1,
  page_size: 20,
} as const;
const booking = (partnerName: string) => ({
  id: "b-1",
  booking_number: "BK-00001",
  status: "confirmed",
  pickup_at: "2026-09-01T04:00:00.000Z",
  return_at: "2026-09-04T04:00:00.000Z",
  partner: { id: "p", name: partnerName },
  airport: { id: "a", code: "DXB", timezone: "Asia/Dubai" },
  category: { id: "c", name: "Toddler" },
  seat: null,
  flight: {
    flight_number: "EK 203",
    scheduled_arrival_at: "2026-09-01T04:00:00.000Z",
    estimated_arrival_at: "2026-09-01T03:15:00.000Z",
    actual_arrival_at: null,
    delay_minutes: null,
  },
});
const table = (partnerName = "ERAC") =>
  html(
    createElement(BookingsTable, {
      bookings: [booking(partnerName)],
      query,
    } as never),
  );

describe("bookings table (UI-F06-S03, R10)", () => {
  it("should become cards on a phone", () => {
    expect(table()).toContain('data-stacked=""');
  });

  it("should label every cell with its column", () => {
    const out = table();
    const cells = out.match(/<td /g)?.length ?? 0;
    const labelled = out.match(/<td [^>]*data-label="[^"]+"/g)?.length ?? 0;

    expect(cells).toBe(5);
    expect(labelled).toBe(cells);
  });

  it("should sort by links that say the direction, 44 px high on a touch screen", () => {
    const out = table();

    expect(out).toContain("pointer-coarse:min-h-11");
    expect(out).toContain('aria-sort="descending"');
  });

  it("should show the flight and how early it is in its own column", () => {
    expect(table()).toContain("EK 203 · −45m");
  });

  it("should show a dash for a booking with no flight", () => {
    const out = html(
      createElement(BookingsTable, {
        bookings: [{ ...booking("ERAC"), flight: null }],
        query,
      } as never),
    );

    expect(out).toMatch(/data-label="Flight"[^>]*>-</);
  });

  it("should open the booking from the whole row, by a link on the booking number that says which one", () => {
    const out = table();

    expect(out).toMatch(
      /<a [^>]*aria-label="View booking BK-00001"[^>]*href="\/bookings\/b-1"[^>]*>BK-00001<\/a>/,
    );
    expect(out).toContain("after:absolute after:inset-0");
    expect(out).toContain("cursor-pointer");
  });

  it("should have the columns of the design and no View column", () => {
    const out = table();

    for (const name of ["Booking", "Partner", "Pickup", "Flight", "Status"])
      expect(out).toContain(`data-label="${name}"`);
    for (const name of ["Airport", "Return", "Actions"])
      expect(out).not.toContain(`data-label="${name}"`);
    expect(out).not.toContain(">View<");
  });

  it("should keep a very long partner name whole, cut in the table and wrapped in a card", () => {
    const out = table(LONG);

    expect(out).toContain(`title="${LONG}"`);
    expect(out).toContain("truncate");
    expect(out).toContain("max-sm:max-w-none");
  });

  it("should keep a partner name with no spaces whole", () => {
    expect(table(NO_BREAK)).toContain(NO_BREAK);
  });
});

describe("bookings pagination (UI-F06-S03)", () => {
  const draw = (page: number, total: number) =>
    html(
      createElement(BookingsPagination, {
        query: { ...query, page },
        total,
      } as never),
    );

  it("should say which bookings are shown out of how many", () => {
    expect(draw(2, 45)).toContain("Showing 21–40 of 45");
  });

  it("should end the range at the last booking on the last page", () => {
    expect(draw(3, 45)).toContain("Showing 41–45 of 45");
  });

  it("should disable Previous on the first page and Next on the last", () => {
    expect(draw(1, 5).match(/aria-disabled="true"/g)).toHaveLength(2);
  });
});

describe("bookings filters (UI-F06-S03)", () => {
  const draw = (extra: Record<string, unknown> = {}) =>
    html(
      createElement(BookingsFilters, {
        sort: "pickup_at",
        order: "desc",
        airports: [],
        ...extra,
      } as never),
    );

  it("should offer Clear all only when a filter is set", () => {
    expect(draw()).not.toContain("Clear all");
    expect(draw({ status: "pending" })).toContain("Clear all");
    expect(draw({ q: "BK-1" })).toContain("Clear all");
  });

  it("should send Clear all back to the list with no filter, keeping the sort", () => {
    expect(draw({ q: "BK-1" })).toMatch(
      /<a [^>]*href="\/bookings\?sort=pickup_at&(amp;)?order=desc"[^>]*>Clear all<\/a>/,
    );
  });
});

describe("booking timeline (UI-F06-S03)", () => {
  const event = (over: Record<string, unknown>) => ({
    id: "e-1",
    event_type: "created",
    created_at: "2026-09-01T04:00:00.000Z",
    actor_name: "Priya",
    notes: null,
    ...over,
  });
  const draw = (events: unknown[], truncated = false) =>
    html(
      createElement(BookingEventsTimeline, {
        events,
        truncated,
        timeZone: "Asia/Dubai",
      } as never),
    );

  it("should draw the events with the shared timeline, with who made them", () => {
    const out = draw([event({})]);

    expect(out).toContain('data-slot="timeline"');
    expect(out).toContain("Booking created");
    expect(out).toContain("Priya");
  });

  it("should say so when there are no events", () => {
    expect(draw([])).toContain("No events recorded.");
  });

  it("should give the reason of a change, and say Staff when the actor is unknown", () => {
    const out = draw([event({ actor_name: null, notes: "Guest asked" })]);

    expect(out).toContain("Reason: Guest asked");
    expect(out).toContain("Staff");
  });

  it("should say that only the latest events are shown", () => {
    expect(draw([event({})], true)).toContain("Showing latest");
  });
});
