import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_ERROR,
  INTERNAL_ERROR,
  VALIDATION_ERROR,
  mapMoveSettlementError,
  mapSettlementError,
} from "@/features/settlements/lib/settlement-errors";

describe("mapSettlementError", () => {
  it("should map a role that may not generate to FORBIDDEN", () => {
    expect(mapSettlementError({ code: "42501" })).toBe(FORBIDDEN_ERROR);
  });

  it("should map an unknown partner to NOT_FOUND on the partner field", () => {
    expect(mapSettlementError({ code: "P0002" })).toMatchObject({ code: "NOT_FOUND", field: "partner_id" });
  });

  it("should map a future month to a validation error on the month field", () => {
    expect(mapSettlementError({ code: "ST002" })).toMatchObject({ code: "VALIDATION_ERROR", field: "month" });
  });

  it("should map a month that is already settled to CONFLICT", () => {
    expect(mapSettlementError({ code: "ST003" })).toMatchObject({ code: "CONFLICT", field: "month" });
  });

  it("should map a month with no completed rental to CONFLICT with its own message", () => {
    const error = mapSettlementError({ code: "ST004" });

    expect(error).toMatchObject({ code: "CONFLICT", field: "month" });
    expect(error.message).toContain("no completed rental");
  });

  it("should map a missing value to the generic validation error", () => {
    expect(mapSettlementError({ code: "22023" })).toBe(VALIDATION_ERROR);
  });

  it("should never pass an unknown database error to the client", () => {
    expect(mapSettlementError({ code: "XX000" })).toBe(INTERNAL_ERROR);
  });
});

describe("mapMoveSettlementError", () => {
  it("should map a role that may not move to FORBIDDEN", () => {
    expect(mapMoveSettlementError({ code: "42501" })).toBe(FORBIDDEN_ERROR);
  });

  it("should map a move that is not allowed to CONFLICT with a message to reload", () => {
    const error = mapMoveSettlementError({ code: "ST006" });

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toContain("cannot move");
  });

  it("should map an unknown settlement to NOT_FOUND and a missing value to a validation error", () => {
    expect(mapMoveSettlementError({ code: "P0002" }).code).toBe("NOT_FOUND");
    expect(mapMoveSettlementError({ code: "22023" })).toBe(VALIDATION_ERROR);
  });

  it("should never pass an unknown database error to the client", () => {
    expect(mapMoveSettlementError({ code: "XX000" })).toBe(INTERNAL_ERROR);
  });
});
