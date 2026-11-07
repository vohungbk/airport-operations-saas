import { describe, expect, it } from "vitest";

import {
  COMPLAINTS_MISSING_INPUT,
  NO_INSTALLATION_TIME_INPUT,
  NO_PREPARATION_TIME_INPUT,
  NO_UTILISATION_INPUT,
  averagePreparationFigure,
  averageRentalDurationFigure,
  complaintsFigure,
  installationTimeFigure,
  inventoryBufferFigure,
  refundsFigure,
  replacementRateFigure,
  seatUtilisationFigure,
} from "@/lib/kpi/additional-kpi-figures";

describe("seatUtilisationFigure (VI-F05-S02, AC01)", () => {
  it("should be the rented seat-days over the available seat-days, in percent", () => {
    expect(seatUtilisationFigure({ completed_bookings: 10, rented_days: 340 }, { available_seat_days: 500 })).toEqual({
      state: "value",
      value: 68,
    });
  });

  it("should say no data when no rental is completed, never 0%", () => {
    expect(seatUtilisationFigure({ completed_bookings: 0, rented_days: 0 }, { available_seat_days: 500 })).toEqual({ state: "no_data" });
  });

  it("should say not available when no seat-day is available, never divide by zero (E4)", () => {
    expect(seatUtilisationFigure({ completed_bookings: 4, rented_days: 20 }, { available_seat_days: 0 })).toEqual({
      state: "not_available",
      reason: NO_UTILISATION_INPUT,
    });
  });
});

describe("averageRentalDurationFigure", () => {
  it("should be the paid days over the completed rentals, to one decimal", () => {
    expect(averageRentalDurationFigure({ completed_bookings: 240, paid_days: 1248 })).toEqual({ state: "value", value: 5.2 });
  });

  it("should say no data when no rental is completed", () => {
    expect(averageRentalDurationFigure({ completed_bookings: 0, paid_days: 0 })).toEqual({ state: "no_data" });
  });
});

describe("inventoryBufferFigure", () => {
  it("should give the seats available and the airports they are at", () => {
    expect(inventoryBufferFigure({ seats_in_service: 40, available_seats: 16, airport_codes: "DXB" })).toEqual({
      state: "value",
      seats: 16,
      airports: "DXB",
    });
  });

  it("should keep 0 available seats as a real 0 while seats are in service", () => {
    expect(inventoryBufferFigure({ seats_in_service: 40, available_seats: 0, airport_codes: "DXB" })).toMatchObject({ state: "value", seats: 0 });
  });

  it("should say no data when no seat is in service", () => {
    expect(inventoryBufferFigure({ seats_in_service: 0, available_seats: 0, airport_codes: "" })).toEqual({ state: "no_data" });
  });
});

describe("replacementRateFigure", () => {
  it("should be the replacements over the completed rentals, in percent", () => {
    expect(replacementRateFigure({ completed_bookings: 240, replacements: 2 })).toEqual({
      state: "value",
      percent: 0.8,
      replacements: 2,
      rentals: 240,
    });
  });

  it("should say no data when no rental is completed", () => {
    expect(replacementRateFigure({ completed_bookings: 0, replacements: 0 })).toEqual({ state: "no_data" });
  });
});

describe("averagePreparationFigure and installationTimeFigure", () => {
  it("should average only the bookings that have a start time", () => {
    expect(averagePreparationFigure({ prepared_bookings: 5, preparation_timed: 4, preparation_minutes: 96 })).toEqual({ state: "value", value: 24 });
    expect(installationTimeFigure({ installation_jobs: 3, installation_timed: 2, installation_minutes: 24 })).toEqual({ state: "value", value: 12 });
  });

  it("should say not available when nothing was timed, never 0 minutes", () => {
    expect(averagePreparationFigure({ prepared_bookings: 5, preparation_timed: 0, preparation_minutes: 0 })).toEqual({
      state: "not_available",
      reason: NO_PREPARATION_TIME_INPUT,
    });
    expect(installationTimeFigure({ installation_jobs: 3, installation_timed: 0, installation_minutes: 0 })).toEqual({
      state: "not_available",
      reason: NO_INSTALLATION_TIME_INPUT,
    });
  });

  it("should say no data when nothing reached the end step", () => {
    expect(averagePreparationFigure({ prepared_bookings: 0, preparation_timed: 0, preparation_minutes: 0 })).toEqual({ state: "no_data" });
    expect(installationTimeFigure({ installation_jobs: 0, installation_timed: 0, installation_minutes: 0 })).toEqual({ state: "no_data" });
  });
});

describe("refundsFigure", () => {
  it("should give the amount and how many bookings were refunded", () => {
    expect(refundsFigure({ completed_bookings: 240, refund_amount: 150, refunded_bookings: 3 })).toEqual({
      state: "value",
      amount: 150,
      refunded_bookings: 3,
    });
  });

  it("should give a real 0 when rentals are completed and none was refunded", () => {
    expect(refundsFigure({ completed_bookings: 12, refund_amount: 0, refunded_bookings: 0 })).toMatchObject({ state: "value", amount: 0 });
  });

  it("should say no data when no rental is completed", () => {
    expect(refundsFigure({ completed_bookings: 0, refund_amount: 0, refunded_bookings: 0 })).toEqual({ state: "no_data" });
  });
});

describe("complaintsFigure", () => {
  it("should always say not available, because no complaint record exists (spec Q3)", () => {
    expect(complaintsFigure()).toEqual({ state: "not_available", reason: COMPLAINTS_MISSING_INPUT });
  });
});
