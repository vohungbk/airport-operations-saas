import { describe, expect, it } from "vitest";

import {
  buildSettlementsHref,
  isSettlementsFiltered,
  resolveSettlementsQuery,
  settlementsQuerySchema,
} from "@/features/settlements/schemas/settlements-query.schema";

const GUID = "9b2f6f0e-6f5e-4c9e-8a53-0a3f6b1c2d3e";

describe("settlementsQuerySchema", () => {
  it("should read the filters and the page from the address", () => {
    expect(settlementsQuerySchema.parse({ partner_id: GUID, month: "2026-10", status: "paid", page: "2" })).toEqual({
      partner_id: GUID,
      month: "2026-10",
      status: "paid",
      page: 2,
    });
  });

  it("should fall back to no filter and page 1 for garbled values", () => {
    expect(settlementsQuerySchema.parse({ partner_id: "x", month: "2026-13", status: "nope", page: "-4" })).toEqual({
      partner_id: undefined,
      month: undefined,
      status: undefined,
      page: 1,
    });
  });

  it("should drop the partner filter of a partner user", () => {
    const query = settlementsQuerySchema.parse({ partner_id: GUID });

    expect(resolveSettlementsQuery(query, true).partner_id).toBeUndefined();
    expect(resolveSettlementsQuery(query, false).partner_id).toBe(GUID);
  });
});

describe("buildSettlementsHref", () => {
  it("should keep the filters and write the page only after the first", () => {
    const query = { month: "2026-10", status: "draft" as const, page: 1 };

    expect(buildSettlementsHref(query)).toBe("/settlements?month=2026-10&status=draft");
    expect(buildSettlementsHref(query, { page: 3 })).toBe("/settlements?month=2026-10&status=draft&page=3");
    expect(buildSettlementsHref({ page: 1 })).toBe("/settlements");
  });

  it("should know when a filter is on", () => {
    expect(isSettlementsFiltered({ page: 2 })).toBe(false);
    expect(isSettlementsFiltered({ page: 1, status: "paid" })).toBe(true);
  });
});
