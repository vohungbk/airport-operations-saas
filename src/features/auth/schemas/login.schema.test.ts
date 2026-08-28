import { describe, expect, it } from "vitest";

import { loginSchema } from "@/features/auth/schemas/login.schema";

describe("loginSchema", () => {
  it("should parse valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "some-password",
    });

    expect(result.success).toBe(true);
  });

  it("should reject an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "some-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "email")).toBe(
        true,
      );
    }
  });

  it("should reject an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "password"),
      ).toBe(true);
    }
  });

  it("should reject a missing password field", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
    });

    expect(result.success).toBe(false);
  });
});
