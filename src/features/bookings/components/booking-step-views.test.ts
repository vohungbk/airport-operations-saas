import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingStepHistory } from "@/features/bookings/components/booking-step-history";
import { BookingStepSummary } from "@/features/bookings/components/booking-step-summary";
import { BookingStepper } from "@/features/bookings/components/booking-stepper";
import type { StepHistoryRow } from "@/features/bookings/lib/booking-step-history";

const ROWS: StepHistoryRow[] = [
  {
    id: "e2",
    title: "Technician Assigned",
    actor_name: "Priya Nair",
    created_at: "2026-10-24T09:05:00Z",
    notes: "Seat reserved.",
  },
  { id: "e1", title: "Booking created", actor_name: null, created_at: "2026-10-24T08:08:00Z", notes: null },
];

describe("BookingStepper (CO-F08-S06 AC02)", () => {
  it("should show every step in order and say which one the booking is at", () => {
    const html = renderToStaticMarkup(createElement(BookingStepper, { status: "assigned" }));

    expect(html).toContain("Step 5 of 13");
    expect(html.indexOf("New")).toBeLessThan(html.indexOf("Allocated"));
    expect(html.indexOf("Allocated")).toBeLessThan(html.indexOf("Technician Assigned"));
    expect(html.indexOf("Active Rental")).toBeLessThan(html.indexOf("Available"));
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("should mark the steps behind the booking as done", () => {
    const html = renderToStaticMarkup(createElement(BookingStepper, { status: "in_progress" }));

    expect(html.match(/\(done\)/g)).toHaveLength(8);
  });

  it("should have no current step for a booking off the path", () => {
    const html = renderToStaticMarkup(createElement(BookingStepper, { status: "cancelled" }));

    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("Step ");
  });
});

describe("BookingStepSummary (CO-F08-S06 AC01, AC02)", () => {
  it("should show the step, the seat status and the time in the step", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepSummary, { status: "assigned", seatStatus: "reserved", timeInStep: "2 h 10 min" }),
    );

    expect(html).toContain("Technician Assigned");
    expect(html).toContain("Reserved");
    expect(html).toContain("2 h 10 min");
  });

  it("should show a dash, not a made-up value, when there is no seat and no event", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepSummary, { status: "pending", seatStatus: null, timeInStep: null }),
    );

    expect(html).toContain("Seat status");
    expect(html.match(/>-</g)).toHaveLength(2);
  });
});

describe("BookingStepSummary deadline (CO-F08-S07 AC01)", () => {
  const base = { status: "confirmed" as const, seatStatus: null, timeInStep: null };

  it("should show the deadline row and, when it is missed, how long the booking is overdue", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepSummary, {
        ...base,
        deadline: { dueLabel: "24 Oct 2026 · 14:55 GST", overdueLabel: "Overdue by 20 min" },
      }),
    );

    expect(html).toContain("Deadline");
    expect(html).toContain("24 Oct 2026 · 14:55 GST");
    expect(html).toContain("Overdue by 20 min");
  });

  it("should show the deadline after the seat status", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepSummary, {
        ...base,
        deadline: { dueLabel: "24 Oct 2026 · 14:55 GST", overdueLabel: null },
      }),
    );

    expect(html.indexOf("Seat status")).toBeLessThan(html.indexOf("Deadline"));
  });

  it("should not flag a step that is on time", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepSummary, {
        ...base,
        deadline: { dueLabel: "24 Oct 2026 · 14:55 GST", overdueLabel: null },
      }),
    );

    expect(html).toContain("Deadline");
    expect(html).not.toContain("Overdue");
  });

  it("should show no deadline row when there is none", () => {
    const html = renderToStaticMarkup(createElement(BookingStepSummary, base));

    expect(html).not.toContain("Deadline");
    expect(html).not.toContain("Overdue");
  });
});

describe("BookingStepHistory (CO-F08-S06 AC02, AC04)", () => {
  it("should show who moved the booking, when, and the note", () => {
    const html = renderToStaticMarkup(createElement(BookingStepHistory, { rows: ROWS, timeZone: "Asia/Dubai" }));

    expect(html).toContain("Priya Nair");
    expect(html).toContain("24 Oct 2026, 13:05");
    expect(html).toContain("Seat reserved.");
    expect(html).toContain("Booking created");
  });

  it("should say Staff when the actor is hidden from the viewer", () => {
    const html = renderToStaticMarkup(createElement(BookingStepHistory, { rows: ROWS, timeZone: "Asia/Dubai" }));

    expect(html).toContain("Staff · 24 Oct 2026, 12:08");
  });

  it("should say so when there are no events", () => {
    const html = renderToStaticMarkup(createElement(BookingStepHistory, { rows: [], timeZone: "UTC" }));

    expect(html).toContain("No events recorded.");
  });

  it("should say that older events are not shown when the list was cut off", () => {
    const html = renderToStaticMarkup(
      createElement(BookingStepHistory, { rows: ROWS, timeZone: "UTC", truncated: true }),
    );

    expect(html).toContain("Showing latest 100 events");
  });
});
