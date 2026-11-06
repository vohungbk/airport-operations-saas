import { describe, expect, it } from "vitest";

import {
  CORRECT_SEAT_MISSING_INPUT,
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
