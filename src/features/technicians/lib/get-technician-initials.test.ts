import { describe, expect, it } from "vitest";

import { getTechnicianInitials } from "@/features/technicians/lib/get-technician-initials";

describe("getTechnicianInitials", () => {
  it("should return the first letter of each word", () => {
    expect(getTechnicianInitials("Nguyen Van An")).toBe("NVA");
  });

  it("should keep at most three letters", () => {
    expect(getTechnicianInitials("Nguyen Thi Minh Chau")).toBe("NTM");
  });

  it("should ignore extra spaces and upper-case the letters", () => {
    expect(getTechnicianInitials("  le   minh ")).toBe("LM");
  });

  it("should return an empty string for an empty name", () => {
    expect(getTechnicianInitials("   ")).toBe("");
  });
});
