import { describe, expect, it } from "vitest";

import type { FlightUpdateItem } from "@/features/flights/schemas/flight-update.schema";

import { describeChange, formatUpdateDetail, formatUpdateHeadline } from "./flight-update-format";

const ZONE = "Asia/Dubai";

const update = (overrides: Partial<FlightUpdateItem> = {}): FlightUpdateItem => ({
  id: "u-1",
  source: "provider",
  // 14:02 in Dubai (UTC+4)
  occurred_at: "2026-10-24T10:02:00.000Z",
  changes: [{ field: "estimated_arrival_at", from: "2026-10-24T12:30:00Z", to: "2026-10-24T11:45:00Z" }],
  ...overrides,
});

describe("formatUpdateHeadline (VI-F02-T01-AC02)", () => {
  it("should write the time, the source and what changed, as the design does", () => {
    expect(formatUpdateHeadline(update(), ZONE)).toBe(
      "14:02 · Provider — Estimated arrival updated to 15:45 GST",
    );
  });

  it("should name each of the three sources", () => {
    expect(formatUpdateHeadline(update({ source: "system" }), ZONE)).toContain("· System —");
    expect(formatUpdateHeadline(update({ source: "manual" }), ZONE)).toContain("· Manual —");
  });

  it("should write the time in the time zone of the airport, not in UTC", () => {
    expect(formatUpdateHeadline(update(), "UTC")).toContain("10:02 ·");
    expect(formatUpdateHeadline(update(), ZONE)).toContain("14:02 ·");
  });

  it("should list every change of an entry on one line", () => {
    const text = formatUpdateHeadline(
      update({
        changes: [
          { field: "status", from: "scheduled", to: "delayed" },
          { field: "terminal", from: "1", to: "3" },
        ],
      }),
      ZONE,
    );

    expect(text).toBe("14:02 · Provider — Status changed to Delayed; Terminal changed to 3");
  });
});

describe("formatUpdateDetail", () => {
  it("should write the date, the time zone and that the record is kept, as the design does", () => {
    expect(formatUpdateDetail(update(), ZONE)).toBe("24 Oct 2026 · Asia/Dubai · Audit record retained");
  });

  it("should use the date of the airport when it is not the date in UTC", () => {
    const late = update({ occurred_at: "2026-10-24T21:30:00.000Z" });

    expect(formatUpdateDetail(late, ZONE)).toContain("25 Oct 2026");
  });
});

describe("describeChange", () => {
  it("should say what each tracked field changed to", () => {
    expect(describeChange({ field: "status", from: "scheduled", to: "landed" }, ZONE)).toBe("Status changed to Landed");
    expect(describeChange({ field: "actual_arrival_at", from: null, to: "2026-10-24T11:41:00Z" }, ZONE)).toBe(
      "Actual arrival updated to 15:41 GST",
    );
    expect(describeChange({ field: "terminal", from: "1", to: "3" }, ZONE)).toBe("Terminal changed to 3");
    expect(describeChange({ field: "delay_minutes", from: null, to: 40 }, ZONE)).toBe("Delay updated to 40 min");
  });

  it("should say a value is cleared when it goes away", () => {
    expect(describeChange({ field: "estimated_arrival_at", from: "2026-10-24T11:45:00Z", to: null }, ZONE)).toBe(
      "Estimated arrival cleared",
    );
    expect(describeChange({ field: "terminal", from: "3", to: null }, ZONE)).toBe("Terminal cleared");
    expect(describeChange({ field: "delay_minutes", from: 40, to: null }, ZONE)).toBe("Delay cleared");
    expect(describeChange({ field: "actual_arrival_at", from: "2026-10-24T11:41:00Z", to: null }, ZONE)).toBe(
      "Actual arrival cleared",
    );
    expect(describeChange({ field: "status", from: "landed", to: null }, ZONE)).toBe("Status cleared");
  });

  it("should show a time that is not a date as it was stored, and not fail", () => {
    expect(describeChange({ field: "estimated_arrival_at", from: null, to: "soon" }, ZONE)).toBe(
      "Estimated arrival updated to soon",
    );
  });

  it("should show a status it does not know without failing", () => {
    expect(describeChange({ field: "status", from: null, to: "teleported" }, ZONE)).toBe(
      "Status changed to teleported",
    );
  });
});
