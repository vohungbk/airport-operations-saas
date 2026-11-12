import { describe, expect, it } from "vitest";

import {
  buildReturnQueueView,
  toReturnQueueItem,
  type ReturnQueueBookingRow,
} from "@/features/return-queue/lib/return-queue";
import { parseReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

const NOW = new Date("2026-11-04T07:02:00Z");

function row(overrides: Partial<ReturnQueueBookingRow> = {}): ReturnQueueBookingRow {
  return {
    id: "b-1",
    booking_number: "BK-2026-000123",
    status: "cleaning",
    airport: { code: "DXB", timezone: "Asia/Dubai" },
    partner: { name: "Emirates Rent A Car" },
    seat: { id: "s-1", serial_number: "SEAT-0001", status: "cleaning" },
    events: [
      { to_status: "returned", created_at: "2026-11-04T06:00:00Z" },
      { to_status: "cleaning", created_at: "2026-11-04T06:20:00Z" },
    ],
    ...overrides,
  };
}

function item(overrides: Partial<ReturnQueueBookingRow> = {}) {
  return toReturnQueueItem(row(overrides), NOW);
}

describe("toReturnQueueItem", () => {
  it("should give the returned time and the minutes waited in the current step", () => {
    expect(item()).toMatchObject({
      seat_serial_number: "SEAT-0001",
      current_step_label: "Cleaning",
      returned_at: "2026-11-04T06:00:00Z",
      step_started_at: "2026-11-04T06:20:00Z",
      waiting_minutes: 42,
    });
  });

  it("should leave the times empty when no event says when the step began", () => {
    expect(item({ events: [] })).toMatchObject({
      returned_at: null,
      step_started_at: null,
      waiting_minutes: null,
    });
  });

  it("should use the latest event when the booking entered the step twice", () => {
    const result = item({
      events: [
        { to_status: "cleaning", created_at: "2026-11-04T05:00:00Z" },
        { to_status: "cleaning", created_at: "2026-11-04T06:50:00Z" },
      ],
    });

    expect(result.waiting_minutes).toBe(12);
  });
});

describe("buildReturnQueueView", () => {
  const items = [
    item(),
    item({
      id: "b-2",
      booking_number: "BK-2026-000124",
      status: "returned",
      seat: { id: "s-2", serial_number: "SEAT-0002", status: "in_use" },
      events: [{ to_status: "returned", created_at: "2026-11-04T06:44:00Z" }],
    }),
    item({
      id: "b-3",
      booking_number: "BK-2026-000125",
      status: "inspection",
      seat: { id: "s-3", serial_number: "SEAT-0003", status: "quarantine" },
      events: [{ to_status: "inspection", created_at: "2026-11-04T05:24:00Z" }],
    }),
  ];

  it("should list the longest wait first and count the seats at each step", () => {
    const view = buildReturnQueueView(items, parseReturnQueueQuery({}));

    expect(view.items.map((i) => i.seat_serial_number)).toEqual([
      "SEAT-0003",
      "SEAT-0001",
      "SEAT-0002",
    ]);
    expect(view.all_count).toBe(3);
    expect(view.step_counts).toMatchObject({
      returned: 1,
      cleaning: 1,
      quarantine: 1,
      final_inspection: 0,
      drying: 0,
    });
  });

  it("should keep only the seats of the chosen step and keep the counts of every step", () => {
    const view = buildReturnQueueView(items, parseReturnQueueQuery({ step: "quarantine" }));

    expect(view.items.map((i) => i.booking_number)).toEqual(["BK-2026-000125"]);
    expect(view.total).toBe(1);
    expect(view.step_counts.cleaning).toBe(1);
  });

  it.each([["seat-0002"], ["000124"]])(
    "should find a seat by seat or booking number with %j",
    (q) => {
      const view = buildReturnQueueView(items, parseReturnQueueQuery({ q }));

      expect(view.items.map((i) => i.booking_id)).toEqual(["b-2"]);
      expect(view.all_count).toBe(1);
    },
  );

  it("should return an empty page when no seat is waiting", () => {
    const view = buildReturnQueueView([], parseReturnQueueQuery({}));

    expect(view).toMatchObject({ items: [], total: 0, all_count: 0 });
  });

  it("should return only the rows of the requested page", () => {
    const view = buildReturnQueueView(
      items,
      parseReturnQueueQuery({ page: "2", page_size: "2" }),
    );

    expect(view.items.map((i) => i.booking_id)).toEqual(["b-2"]);
    expect(view.total).toBe(3);
  });
});
