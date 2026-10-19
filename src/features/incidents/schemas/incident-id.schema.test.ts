import { describe, expect, it } from "vitest";

import { incidentIdSchema } from "@/features/incidents/schemas/incident-id.schema";

describe("incidentIdSchema", () => {
  it("should accept a seeded id that is not an RFC-variant uuid", () => {
    expect(
      incidentIdSchema.safeParse("c0000000-0000-0000-0000-000000000001").success,
    ).toBe(true);
  });

  it.each([[""], ["abc"], ["c0000000-0000-0000-0000-00000000000"]])(
    "should reject %j",
    (value) => {
      expect(incidentIdSchema.safeParse(value).success).toBe(false);
    },
  );
});
