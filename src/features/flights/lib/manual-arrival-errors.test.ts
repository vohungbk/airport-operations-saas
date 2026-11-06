import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mapManualArrivalError } from "@/features/flights/lib/manual-arrival-errors";

const error = (code: string, message = ""): PostgrestError =>
  ({ code, message, details: "", hint: "", name: "PostgrestError" }) as PostgrestError;

describe("mapManualArrivalError (VI-F02-S07)", () => {
  it("should map the role check of the database function to forbidden", () => {
    expect(mapManualArrivalError(error("42501")).code).toBe("FORBIDDEN");
  });

  it("should map a missing row to not found", () => {
    expect(mapManualArrivalError(error("P0002")).code).toBe("NOT_FOUND");
  });

  it("should map the value errors of the function to their own codes", () => {
    expect(mapManualArrivalError(error("22023", "The booking has ended")).code).toBe("BOOKING_ENDED");
    expect(mapManualArrivalError(error("22023", "The booking has no flight number")).code).toBe("NO_FLIGHT_NUMBER");
    expect(mapManualArrivalError(error("22023", "Nothing changed")).code).toBe("NO_CHANGE");
    expect(mapManualArrivalError(error("22023", "A reason is required")).code).toBe("VALIDATION_ERROR");
  });

  it("should hide any other database error behind an internal error", () => {
    const mapped = mapManualArrivalError(error("XX000", "relation flights exploded"));

    expect(mapped.code).toBe("INTERNAL_ERROR");
    expect(mapped.message).not.toContain("exploded");
  });
});
