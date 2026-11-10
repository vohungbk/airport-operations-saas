import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { BookingForm } from "@/features/bookings/components/booking-form";

const register = ((name: string) => ({ name })) as never;
const OPTIONS = {
  airports: [{ value: "a1", label: "DXB - Dubai" }],
  categories: [{ value: "c1", label: "Toddler" }],
};

/** The selects are library parts read through a form `control`, so the form needs a real one. */
function PartnerCreate() {
  const { control } = useForm();

  return createElement(BookingForm, {
    mode: "partner-create",
    register,
    control: control as never,
    errors: {},
    isPending: false,
    options: OPTIONS,
    timeZone: null,
  });
}

const SUMMARY = {
  partner: "Emirates Rent A Car",
  airport: "DXB",
  category: "Convertible",
  daily_rate: "20.00",
};

function Edit({ seat, locked = false }: { seat: boolean; locked?: boolean }) {
  const { control } = useForm();

  return createElement(BookingForm, {
    mode: "edit",
    register,
    control: control as never,
    errors: {},
    isPending: false,
    availableSeats: { isReady: seat, isLoading: false, seats: [], failed: false },
    timeZone: "Asia/Dubai",
    currentSeat: null,
    summary: SUMMARY,
    pickupLocked: locked,
  });
}

function PartnerEdit() {
  const { control } = useForm();

  return createElement(BookingForm, {
    mode: "partner-edit",
    register,
    control: control as never,
    errors: {},
    isPending: false,
    timeZone: "Asia/Dubai",
    summary: { airport: "DXB", category: "Convertible" },
  });
}

describe("BookingForm for a partner user (VI-F03-S03)", () => {
  it("should show no partner and no seat field on create, but the airport, category, rate and times", () => {
    const html = renderToStaticMarkup(createElement(PartnerCreate));

    expect(html).not.toContain('id="partner_id"');
    expect(html).not.toContain('id="assigned_seat_id"');
    for (const id of ["airport_id", "seat_category_id", "daily_rate", "pickup_at", "return_at"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("should show only the schedule and details on edit: no seat, rate, airport or category", () => {
    const html = renderToStaticMarkup(createElement(PartnerEdit));

    for (const id of ["assigned_seat_id", "daily_rate", "airport_id", "seat_category_id", "partner_id"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    for (const id of ["pickup_at", "return_at", "notes"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});

describe("BookingForm controls (UI-F06-S03)", () => {
  it("should draw the selects and the notes from the library, not as native controls", () => {
    const html = renderToStaticMarkup(createElement(PartnerCreate));

    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain('data-slot="textarea"');
    expect(html).not.toContain("<select");
  });

  it("should keep the seat select on edit, with its hint", () => {
    const html = renderToStaticMarkup(createElement(Edit, { seat: true }));

    expect(html).toContain('id="assigned_seat_id"');
    expect(html).toContain("No seats found for this airport and category.");
  });

  it("should show the sections of the design in order, with the seat after the child", () => {
    const html = renderToStaticMarkup(createElement(Edit, { seat: true }));
    const titles = [
      "Booking information",
      "Pickup and return",
      "Child",
      "Seat",
      "Price",
      "Flight and vehicle",
      "Notes",
    ];
    const positions = titles.map((title) => html.indexOf(`aria-label="${title}"`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("should show partner, airport, category and price as locked values on edit", () => {
    const html = renderToStaticMarkup(createElement(Edit, { seat: true }));

    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("20.00");
    expect(html).not.toContain('id="partner_id"');
    expect(html).not.toContain('id="daily_rate"');
  });

  it("should lock pickup and seat with the reason once the pickup has passed", () => {
    const locked = renderToStaticMarkup(createElement(Edit, { seat: true, locked: true }));
    const open = renderToStaticMarkup(createElement(Edit, { seat: true }));

    expect(locked).toContain("Locked: the pickup time has passed.");
    expect(locked).toContain('aria-label="Locked"');
    expect(open).not.toContain("Locked: the pickup time has passed.");
  });

  it("should use a USD prefix for the price and a cm suffix for the child height on create", () => {
    const html = renderToStaticMarkup(createElement(PartnerCreate));

    expect(html).toContain("USD");
    expect(html).toContain("cm");
    expect(html).toContain("Daily price");
  });
});
