import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";

import { mapSeatCategoryError } from "@/features/seat-categories/lib/seat-category-errors";

function pgError(code: string): PostgrestError {
  return {
    code,
    message: "raw",
    details: "",
    hint: "",
    name: "PostgrestError",
  } as PostgrestError;
}

describe("mapSeatCategoryError", () => {
  it("should map a 23514 check violation to VALIDATION_ERROR", () => {
    expect(mapSeatCategoryError(pgError("23514")).code).toBe("VALIDATION_ERROR");
  });

  it("should map a 42501 RLS denial to FORBIDDEN", () => {
    expect(mapSeatCategoryError(pgError("42501")).code).toBe("FORBIDDEN");
  });

  it("should map any other error to INTERNAL_ERROR without leaking raw text", () => {
    const result = mapSeatCategoryError(pgError("XX000"));

    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).not.toContain("raw");
  });
});
