import { describe, expect, it } from "vitest";

import { resetPasswordSchema } from "@/features/auth/schemas/reset-password.schema";

describe("resetPasswordSchema", () => {
  it("should parse when password and confirm_password match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "password123",
      confirm_password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("should reject when password and confirm_password do not match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "password123",
      confirm_password: "different123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatchIssue = result.error.issues.find(
        (issue) => issue.path[0] === "confirm_password",
      );
      expect(mismatchIssue).toBeDefined();
      expect(mismatchIssue?.message).toBe("Passwords do not match.");
    }
  });

  it("should reject a password below the 8-character minimum", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short1",
      confirm_password: "short1",
    });

    expect(result.success).toBe(false);
  });
});
