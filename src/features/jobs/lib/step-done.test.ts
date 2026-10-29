import { describe, expect, it } from "vitest";

import {
  STEP_COPY,
  STEP_NAMES,
  bannerLine,
  seatLine,
  stepSchema,
  type StepDone,
} from "@/features/jobs/lib/step-done";

const done = (overrides: Partial<StepDone> = {}): StepDone => ({
  step: "installation",
  job_id: "j-1",
  booking_number: "BK-2026-000123",
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  seat: { serial_number: "SEAT-0001", category_name: "Convertible" },
  completed_by: "Omar Haddad",
  completed_at: "2026-10-24T10:20:00Z",
  ...overrides,
});

describe("stepSchema", () => {
  it("should accept the three steps that end in a record", () => {
    for (const step of STEP_NAMES) {
      expect(stepSchema.safeParse(step).success).toBe(true);
    }
  });

  it("should refuse anything else, so the address cannot name a made-up step", () => {
    for (const value of ["scan", "", "INSTALLATION", undefined, ["installation"]]) {
      expect(stepSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("step success text", () => {
  it("should have a heading and a banner title for each step", () => {
    expect(STEP_COPY.installation).toEqual({ heading: "Installation success", title: "Installation completed" });
    expect(STEP_COPY.cleaning.title).toBe("Cleaning completed");
    expect(STEP_COPY.inspection.title).toBe("Inspection recorded");
  });

  it("should write the booking and the time of the step in the zone of the airport", () => {
    expect(bannerLine(done())).toBe("BK-2026-000123 · Completed at 14:20 GST");
  });

  it("should write the seat with its category, or the serial alone, or nothing", () => {
    expect(seatLine(done())).toBe("SEAT-0001 · Convertible");
    expect(seatLine(done({ seat: { serial_number: "SEAT-0001", category_name: null } }))).toBe("SEAT-0001");
    expect(seatLine(done({ seat: null }))).toBeNull();
  });
});
