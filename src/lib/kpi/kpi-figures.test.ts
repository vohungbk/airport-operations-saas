import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_MISSING_INPUT,
  CORRECT_SEAT_MISSING_INPUT,
  commercialFigure,
  incidentsFigure,
  traceabilityFigure,
  NOT_AVAILABLE_TEXT,
  NO_DATA_TEXT,
  ON_TIME_READINESS_MISSING_INPUT,
  correctSeatFigure,
  formatKpiFigure,
  onTimeReadinessFigure,
  rateFigure,
} from "@/lib/kpi/kpi-figures";

describe("correct-seat fulfilment (VI-F05-T02, AC04)", () => {
  it("should show 90% when the seat matched on 9 of 10 completed bookings", () => {
    const figure = correctSeatFigure({ completed_bookings: 10, with_result: 10, matched: 9 });

    expect(figure).toEqual({ state: "value", percent: 90, numerator: 9, denominator: 10, excluded: 0 });
    expect(formatKpiFigure(figure)).toBe("90%");
  });

  it("should round to one decimal and keep a real 0% when none matched", () => {
    expect(formatKpiFigure(correctSeatFigure({ completed_bookings: 3, with_result: 3, matched: 1 }))).toBe("33.3%");
    expect(formatKpiFigure(correctSeatFigure({ completed_bookings: 4, with_result: 4, matched: 0 }))).toBe("0%");
  });

  it("should leave out a booking whose result is not stored instead of counting it as a failure", () => {
    const figure = correctSeatFigure({ completed_bookings: 12, with_result: 10, matched: 9 });

    expect(figure).toMatchObject({ state: "value", percent: 90, denominator: 10, excluded: 2 });
  });
});

describe("on-time readiness (VI-F05-T02, AC05)", () => {
  it("should show 80% when 8 of 10 Family Ready bookings were before the deadline", () => {
    const figure = onTimeReadinessFigure({ family_ready_bookings: 10, with_deadline: 10, on_time: 8 });

    expect(figure).toMatchObject({ state: "value", percent: 80, numerator: 8, denominator: 10 });
    expect(formatKpiFigure(figure)).toBe("80%");
  });
});

describe("a rate with nothing to show (VI-F05-T02, AC06, AC07)", () => {
  it("should say No data, not 0%, when the denominator is zero", () => {
    const figure = correctSeatFigure({ completed_bookings: 0, with_result: 0, matched: 0 });

    expect(figure).toEqual({ state: "no_data" });
    expect(formatKpiFigure(figure)).toBe(NO_DATA_TEXT);
  });

  it("should say Not available with a reason when no booking has the input stored", () => {
    const seat = correctSeatFigure({ completed_bookings: 5, with_result: 0, matched: 0 });
    const readiness = onTimeReadinessFigure({ family_ready_bookings: 5, with_deadline: 0, on_time: 0 });

    expect(seat).toEqual({ state: "not_available", reason: CORRECT_SEAT_MISSING_INPUT });
    expect(readiness).toEqual({ state: "not_available", reason: ON_TIME_READINESS_MISSING_INPUT });
    expect(formatKpiFigure(seat)).toBe(NOT_AVAILABLE_TEXT);
    expect(formatKpiFigure(readiness)).not.toContain("0%");
  });

  it("should prefer No data over Not available when there is no booking at all", () => {
    expect(rateFigure({ total: 0, with_input: 0, matched: 0 }, "reason")).toEqual({ state: "no_data" });
  });
});

describe("cleaning / inspection traceability (VI-F05-S01, AC03)", () => {
  it("should be the completed bookings that have both records, and count a missing record as a gap", () => {
    expect(traceabilityFigure({ completed_bookings: 240, traced_bookings: 240 })).toMatchObject({
      state: "value",
      percent: 100,
      numerator: 240,
      denominator: 240,
      excluded: 0,
    });
    expect(traceabilityFigure({ completed_bookings: 4, traced_bookings: 3 })).toMatchObject({ percent: 75 });
  });

  it("should say No data when there is no completed booking", () => {
    expect(traceabilityFigure({ completed_bookings: 0, traced_bookings: 0 })).toEqual({ state: "no_data" });
  });
});

describe("operational incidents (VI-F05-S01, AC03)", () => {
  it("should give the incidents and their share of the completed bookings to two decimals", () => {
    expect(incidentsFigure({ completed_bookings: 240, incidents: 3 })).toEqual({
      state: "value",
      incidents: 3,
      completed_bookings: 240,
      percent: 1.25,
    });
  });

  it("should keep a real 0 when there are completed bookings and no incident", () => {
    expect(incidentsFigure({ completed_bookings: 10, incidents: 0 })).toMatchObject({ state: "value", incidents: 0, percent: 0 });
  });

  it("should say No data when there is no completed booking", () => {
    expect(incidentsFigure({ completed_bookings: 0, incidents: 0 })).toEqual({ state: "no_data" });
  });
});

describe("commercial performance (VI-F05-S01, AC03)", () => {
  it("should give the partner revenue share of the completed bookings", () => {
    expect(commercialFigure({ completed_bookings: 240, with_revenue: 240, partner_revenue: 6000 })).toEqual({
      state: "value",
      amount: 6000,
    });
  });

  it("should say No data with no completed booking, and Not available when no share is calculated", () => {
    expect(commercialFigure({ completed_bookings: 0, with_revenue: 0, partner_revenue: 0 })).toEqual({ state: "no_data" });
    expect(commercialFigure({ completed_bookings: 5, with_revenue: 0, partner_revenue: 0 })).toEqual({
      state: "not_available",
      reason: COMMERCIAL_MISSING_INPUT,
    });
  });
});
