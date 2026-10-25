import { describe, expect, it } from "vitest";

import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { ROLES } from "@/lib/auth/roles";

describe("ROLE_LABELS", () => {
  it("should have a label for every role of the database", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });

  it("should write each label as words, not as the enum value", () => {
    for (const label of Object.values(ROLE_LABELS)) {
      expect(label).toMatch(/^[A-Z][A-Za-z ]+$/);
    }
    expect(ROLE_LABELS.operations_manager).toBe("Operations Manager");
  });
});
