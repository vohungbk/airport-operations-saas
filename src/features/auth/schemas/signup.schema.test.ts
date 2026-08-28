import { describe, expect, it } from "vitest";

import { signupSchema, type SignupInput } from "@/features/auth/schemas/signup.schema";

/**
 * Compile-time guard: if `SignupInput` ever gains a `role` or
 * `partner_id` key, this assignment stops compiling (`tsc --noEmit` /
 * `next build`) because `never` can't be assigned `true`. This is the
 * type-level half of "role assignment cannot be controlled by the
 * signup form" — the runtime half is the "malicious payload" test below.
 */
type SignupInputHasNoServerAssignedFields = SignupInput extends
  | { role: unknown }
  | { partner_id: unknown }
  ? never
  : true;
const _signupInputHasNoServerAssignedFields: SignupInputHasNoServerAssignedFields = true;
void _signupInputHasNoServerAssignedFields;

describe("signupSchema", () => {
  it("should parse valid signup input", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      full_name: "Jane Doe",
      password: "password123",
      confirm_password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("should reject an invalid email", () => {
    const result = signupSchema.safeParse({
      email: "not-an-email",
      full_name: "Jane Doe",
      password: "password123",
      confirm_password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "email")).toBe(
        true,
      );
    }
  });

  it("should reject a password below the 8-character minimum", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      full_name: "Jane Doe",
      password: "short1",
      confirm_password: "short1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "password"),
      ).toBe(true);
    }
  });

  it("should reject when password and confirm_password do not match", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      full_name: "Jane Doe",
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

  it("should strip an injected role/partner_id and never expose them on the parsed type", () => {
    // Malicious payload trying to self-assign a privileged role. Zod
    // objects strip unrecognized keys by default, so `role`/`partner_id`
    // must not survive parsing even though the schema doesn't declare
    // them at all.
    const maliciousInput = {
      email: "attacker@example.com",
      full_name: "Attacker",
      password: "password123",
      confirm_password: "password123",
      role: "operator_admin",
      partner_id: "11111111-1111-1111-1111-111111111111",
    };

    const result = signupSchema.safeParse(maliciousInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
      expect(result.data).not.toHaveProperty("partner_id");
    }
  });
});
