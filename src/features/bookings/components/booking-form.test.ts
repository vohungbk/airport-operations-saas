import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BookingForm } from "@/features/bookings/components/booking-form";

const register = ((name: string) => ({ name })) as never;
const OPTIONS = {
  airports: [{ value: "a1", label: "DXB - Dubai" }],
  categories: [{ value: "c1", label: "Toddler" }],
};

describe("BookingForm for a partner user (VI-F03-S03)", () => {
  it("should show no partner and no seat field on create, but the airport, category, rate and times", () => {
    const html = renderToStaticMarkup(
      createElement(BookingForm, {
        mode: "partner-create",
        register,
        errors: {},
        isPending: false,
        options: OPTIONS,
        timeZone: null,
      }),
    );

    expect(html).not.toContain('id="partner_id"');
    expect(html).not.toContain('id="assigned_seat_id"');
    for (const id of ["airport_id", "seat_category_id", "daily_rate", "pickup_at", "return_at"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("should show only the schedule and details on edit: no seat, rate, airport or category", () => {
    const html = renderToStaticMarkup(
      createElement(BookingForm, {
        mode: "partner-edit",
        register,
        errors: {},
        isPending: false,
        timeZone: "Asia/Dubai",
      }),
    );

    for (const id of ["assigned_seat_id", "daily_rate", "airport_id", "seat_category_id", "partner_id"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    for (const id of ["pickup_at", "return_at", "notes"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
