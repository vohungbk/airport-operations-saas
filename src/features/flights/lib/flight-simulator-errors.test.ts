import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { FORBIDDEN_ERROR, INTERNAL_ERROR, mapSimulatorError } from "./flight-simulator-errors";

const error = (code: string) => ({ code, message: "raw database text", details: "", hint: "" }) as PostgrestError;

describe("mapSimulatorError (VI-F02-S12)", () => {
  it("should map the role refusal of the database to forbidden", () => {
    expect(mapSimulatorError(error("42501"))).toBe(FORBIDDEN_ERROR);
  });

  it("should hide any other database error behind a general message", () => {
    const mapped = mapSimulatorError(error("XX000"));

    expect(mapped).toBe(INTERNAL_ERROR);
    expect(mapped.message).not.toContain("raw database text");
  });
});
