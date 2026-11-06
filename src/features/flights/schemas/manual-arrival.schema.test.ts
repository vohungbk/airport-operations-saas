import { describe, expect, it } from "vitest";

import {
  MANUAL_REASON_MAX_LENGTH,
  createManualArrivalSchema,
  manualArrivalActionSchema,
} from "@/features/flights/schemas/manual-arrival.schema";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";
const valid = { arrival_at: "2026-12-01T13:15", scheduled_arrival_at: "", reason: "Passenger called the desk" };

describe("manual arrival schema (VI-F02-S07)", () => {
  it("should accept an arrival and a reason for a booking that has a flight", () => {
    expect(createManualArrivalSchema({ requireScheduled: false }).safeParse(valid).success).toBe(true);
  });

  it("should trim the reason", () => {
    const result = createManualArrivalSchema({ requireScheduled: false }).parse({ ...valid, reason: "  Late bus  " });

    expect(result.reason).toBe("Late bus");
  });

  it("should return an error when the reason is empty or only spaces", () => {
    const schema = createManualArrivalSchema({ requireScheduled: false });

    for (const reason of ["", "   "]) {
      const result = schema.safeParse({ ...valid, reason });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Reason is required.");
    }
  });

  it("should return an error when the reason is longer than the limit", () => {
    const result = createManualArrivalSchema({ requireScheduled: false }).safeParse({
      ...valid,
      reason: "x".repeat(MANUAL_REASON_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
  });

  it("should return an error when the arrival is missing or is not a date and time", () => {
    const schema = createManualArrivalSchema({ requireScheduled: false });

    expect(schema.safeParse({ ...valid, arrival_at: "" }).error?.issues[0].message).toBe("Arrival is required.");
    expect(schema.safeParse({ ...valid, arrival_at: "2026-13-45T99:99" }).error?.issues[0].message).toBe(
      "Arrival must be a valid date and time.",
    );
  });

  it("should require the scheduled arrival only for a booking with no flight yet", () => {
    const strict = createManualArrivalSchema({ requireScheduled: true });

    expect(strict.safeParse(valid).error?.issues[0].message).toBe("Scheduled arrival is required.");
    expect(strict.safeParse({ ...valid, scheduled_arrival_at: "2026-12-01T10:00" }).success).toBe(true);
    expect(strict.safeParse({ ...valid, scheduled_arrival_at: "not a date" }).success).toBe(false);
  });

  it("should reject a scheduled arrival that is not a date when it is optional", () => {
    expect(
      createManualArrivalSchema({ requireScheduled: false }).safeParse({ ...valid, scheduled_arrival_at: "nope" }).success,
    ).toBe(false);
  });

  it("should require a booking id in the action input", () => {
    expect(manualArrivalActionSchema.safeParse(valid).success).toBe(false);
    expect(manualArrivalActionSchema.safeParse({ ...valid, booking_id: BOOKING_ID }).success).toBe(true);
    expect(manualArrivalActionSchema.safeParse({ ...valid, booking_id: "nope" }).success).toBe(false);
  });
});
