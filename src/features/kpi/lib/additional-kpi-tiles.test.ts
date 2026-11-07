import { describe, expect, it } from "vitest";

import {
  NO_INSTALLATIONS_CAPTION,
  NO_READY_BOOKINGS_CAPTION,
  NO_SEATS_CAPTION,
  buildAdditionalKpiTiles,
  formatMinutes,
} from "@/features/kpi/lib/additional-kpi-tiles";
import { NO_COMPLETED_RENTALS_CAPTION } from "@/features/kpi/lib/core-kpi-tiles";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";

const FULL: AdditionalKpis = {
  seat_utilisation: { state: "value", value: 68 },
  average_rental_duration: { state: "value", value: 5.2 },
  inventory_buffer: { state: "value", seats: 16, airports: "DXB" },
  replacement_rate: { state: "value", percent: 0.8, replacements: 2, rentals: 240 },
  average_preparation: { state: "value", value: 24 },
  installation_time: { state: "value", value: 12 },
  refunds: { state: "value", amount: 150, refunded_bookings: 3 },
  complaints: { state: "not_available", reason: "No complaint record exists yet" },
};

const NONE: AdditionalKpis = {
  seat_utilisation: { state: "no_data" },
  average_rental_duration: { state: "no_data" },
  inventory_buffer: { state: "no_data" },
  replacement_rate: { state: "no_data" },
  average_preparation: { state: "no_data" },
  installation_time: { state: "no_data" },
  refunds: { state: "no_data" },
  complaints: { state: "not_available", reason: "No complaint record exists yet" },
};

describe("buildAdditionalKpiTiles (VI-F05-S02, AC01)", () => {
  it("should give the nine tiles of the design, in order, with their value and formula line", () => {
    const tiles = buildAdditionalKpiTiles(FULL, { state: "value", amount: 6000 }, "October 2026");

    expect(tiles.map(({ label, value, caption }) => [label, value, caption])).toEqual([
      ["Seat utilisation", "68%", "Rented seat-days / available seat-days"],
      ["Average rental duration", "5.2 d", "Paid days / completed rentals"],
      ["Inventory buffer", "16", "Available seats at DXB"],
      ["Replacement rate", "0.8%", "2 replacements / 240 rentals"],
      ["Average preparation", "24 min", "Preparation start to Ready"],
      ["Installation time", "12 min", "Install start to completed"],
      ["Refunds", "$150", "USD · 3 refunded bookings"],
      ["Complaints", "Not available", "No complaint record exists yet"],
      ["Monthly partner revenue", "$6,000", "USD · October 2026"],
    ]);
  });

  it("should say No data and never 0 for a figure with nothing to count (E1, E4)", () => {
    const tiles = buildAdditionalKpiTiles(NONE, { state: "no_data" }, "October 2026");
    const byLabel = Object.fromEntries(tiles.map((tile) => [tile.label, tile]));

    for (const label of Object.keys(byLabel).filter((name) => name !== "Complaints")) {
      expect(byLabel[label].value).toBe("No data");
    }
    expect(byLabel["Inventory buffer"].caption).toBe(NO_SEATS_CAPTION);
    expect(byLabel["Average preparation"].caption).toBe(NO_READY_BOOKINGS_CAPTION);
    expect(byLabel["Installation time"].caption).toBe(NO_INSTALLATIONS_CAPTION);
    expect(byLabel["Seat utilisation"].caption).toBe(NO_COMPLETED_RENTALS_CAPTION);
  });

  it("should say Not available with the reason when nothing is stored to measure", () => {
    const tiles = buildAdditionalKpiTiles(
      { ...FULL, installation_time: { state: "not_available", reason: "No installation start time is stored for these bookings" } },
      { state: "not_available", reason: "No partner share is calculated for these bookings" },
      "October 2026",
    );

    expect(tiles[5]).toMatchObject({ value: "Not available", caption: "No installation start time is stored for these bookings" });
    expect(tiles[8]).toMatchObject({ value: "Not available", caption: "No partner share is calculated for these bookings" });
  });

  it("should use the singular for one replacement, one rental and one refunded booking", () => {
    const tiles = buildAdditionalKpiTiles(
      {
        ...FULL,
        replacement_rate: { state: "value", percent: 100, replacements: 1, rentals: 1 },
        refunds: { state: "value", amount: 50.5, refunded_bookings: 1 },
      },
      { state: "value", amount: 10 },
      "Year to date",
    );

    expect(tiles[3].caption).toBe("1 replacement / 1 rental");
    expect(tiles[6]).toMatchObject({ value: "$50.50", caption: "USD · 1 refunded booking" });
    expect(tiles[8].caption).toBe("USD · Year to date");
  });

  it("should keep a real 0 refund as a value when rentals are completed", () => {
    const tiles = buildAdditionalKpiTiles({ ...FULL, refunds: { state: "value", amount: 0, refunded_bookings: 0 } }, { state: "value", amount: 1 }, "October 2026");

    expect(tiles[6]).toMatchObject({ value: "$0", caption: "USD · 0 refunded bookings" });
  });
});

describe("formatMinutes", () => {
  it("should round to whole minutes and switch to hours from 60", () => {
    expect(formatMinutes(24.4)).toBe("24 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(125)).toBe("2 h 5 min");
  });

  it("should say under one minute, never 0 min", () => {
    expect(formatMinutes(0.3)).toBe("<1 min");
  });
});
