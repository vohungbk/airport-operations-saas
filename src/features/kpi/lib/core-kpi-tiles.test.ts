import { describe, expect, it } from "vitest";

import { NO_COMPLETED_RENTALS_CAPTION, NO_FAMILY_READY_CAPTION, buildCoreKpiTiles, isEmptyPeriod } from "@/features/kpi/lib/core-kpi-tiles";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

const FULL: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
  traceability: { state: "value", percent: 100, numerator: 240, denominator: 240, excluded: 0 },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "value", amount: 6000 },
};

const NONE: CoreKpis = {
  correct_seat: { state: "no_data" },
  family_ready_on_time: { state: "no_data" },
  traceability: { state: "no_data" },
  incidents: { state: "no_data" },
  commercial: { state: "no_data" },
};

describe("buildCoreKpiTiles (VI-F05-S01, AC03)", () => {
  it("should give the five tiles of the design, in order, with their numbers", () => {
    expect(buildCoreKpiTiles(FULL).map(({ label, value, caption }) => [label, value, caption])).toEqual([
      ["Correct-seat fulfilment", "99.2%", "238 / 240"],
      ["Family Ready on time", "97.5%", "234 / 240"],
      ["Cleaning / inspection traceability", "100%", "240 / 240 · No data gaps"],
      ["Operational incidents", "3", "1.25%"],
      ["Commercial performance", "$6,000", "USD · Partner revenue share"],
    ]);
  });

  it("should show cents only when the amount has them", () => {
    const tiles = buildCoreKpiTiles({ ...FULL, commercial: { state: "value", amount: 5953.5 } });

    expect(tiles[4].value).toBe("$5,953.50");
  });

  it("should say No data and never 0% for a figure with nothing to count (E4)", () => {
    const tiles = buildCoreKpiTiles(NONE);

    for (const tile of tiles) expect(tile.value).toBe("No data");
    expect(tiles.map((tile) => tile.caption)).toEqual([
      NO_COMPLETED_RENTALS_CAPTION,
      NO_FAMILY_READY_CAPTION,
      NO_COMPLETED_RENTALS_CAPTION,
      NO_COMPLETED_RENTALS_CAPTION,
      NO_COMPLETED_RENTALS_CAPTION,
    ]);
  });

  it("should say Not available with the reason when no input is stored, and say how many rows were left out", () => {
    const tiles = buildCoreKpiTiles({
      ...FULL,
      correct_seat: { state: "not_available", reason: "No seat scan result is stored for these bookings" },
      family_ready_on_time: { state: "value", percent: 90, numerator: 9, denominator: 10, excluded: 2 },
      commercial: { state: "not_available", reason: "No partner share is calculated for these bookings" },
    });

    expect(tiles[0]).toMatchObject({ value: "Not available", caption: "No seat scan result is stored for these bookings" });
    expect(tiles[1].caption).toBe("9 / 10 · 2 left out, data not stored");
    expect(tiles[4]).toMatchObject({ value: "Not available", caption: "No partner share is calculated for these bookings" });
  });

  it("should keep a real 0 incidents when there are completed rentals", () => {
    const tiles = buildCoreKpiTiles({ ...FULL, incidents: { state: "value", incidents: 0, completed_bookings: 12, percent: 0 } });

    expect(tiles[3]).toMatchObject({ value: "0", caption: "0%" });
  });

  it("should not say No data gaps when a booking is missing a record", () => {
    const tiles = buildCoreKpiTiles({ ...FULL, traceability: { state: "value", percent: 75, numerator: 3, denominator: 4, excluded: 0 } });

    expect(tiles[2].caption).toBe("3 / 4");
  });
});

describe("isEmptyPeriod (VI-F05-S01, E1)", () => {
  it("should be empty only when every figure has nothing to count", () => {
    expect(isEmptyPeriod(NONE)).toBe(true);
    expect(isEmptyPeriod(FULL)).toBe(false);
    expect(isEmptyPeriod({ ...NONE, incidents: { state: "value", incidents: 0, completed_bookings: 1, percent: 0 } })).toBe(false);
  });
});

describe("buildCoreKpiTiles with the period before (VI-F05-S01, comparison)", () => {
  const BEFORE: CoreKpis = {
    ...FULL,
    correct_seat: { state: "value", percent: 98.4, numerator: 236, denominator: 240, excluded: 0 },
    family_ready_on_time: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
    incidents: { state: "value", incidents: 5, completed_bookings: 240, percent: 2.08 },
  };

  it("should say how the two rates and the incidents changed, as the design does", () => {
    const tiles = buildCoreKpiTiles(FULL, BEFORE);

    expect(tiles[0].caption).toBe("238 / 240 · ↑ 0.8 pp");
    expect(tiles[1].caption).toBe("234 / 240 · ↓ 1.7 pp");
    expect(tiles[3].caption).toBe("1.25% · ↓ 2 incidents");
  });

  it("should leave traceability and commercial performance without a change line, as the design does", () => {
    const tiles = buildCoreKpiTiles(FULL, BEFORE);

    expect(tiles[2].caption).toBe("240 / 240 · No data gaps");
    expect(tiles[4].caption).toBe("USD · Partner revenue share");
  });

  it("should say No change when the figure did not move, and use the singular for one incident", () => {
    const tiles = buildCoreKpiTiles(FULL, {
      ...BEFORE,
      correct_seat: FULL.correct_seat,
      incidents: { state: "value", incidents: 2, completed_bookings: 240, percent: 0.83 },
    });

    expect(tiles[0].caption).toBe("238 / 240 · No change");
    expect(tiles[3].caption).toBe("1.25% · ↑ 1 incident");
  });

  it("should show no change when the period before has no value, never a change against nothing", () => {
    const tiles = buildCoreKpiTiles(FULL, NONE);

    expect(tiles[0].caption).toBe("238 / 240");
    expect(tiles[1].caption).toBe("234 / 240");
    expect(tiles[3].caption).toBe("1.25%");
  });

  it("should show no change when there is no period to compare with", () => {
    expect(buildCoreKpiTiles(FULL, null)[0].caption).toBe("238 / 240");
    expect(buildCoreKpiTiles(FULL)[0].caption).toBe("238 / 240");
  });
});
