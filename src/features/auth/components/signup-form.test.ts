import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
  state: {
    isPending: false,
    result: null as { success: boolean; message: string } | null,
    errors: {} as Record<string, { message: string }>,
  },
}));

vi.mock("@/features/auth/hooks/use-signup-form", () => ({
  useSignupForm: () => {
    // A real form, so the agree box (a Controller) has a control to read.
    const form = useForm({ defaultValues: { accepted_terms: false } });
    return {
      form: {
        register: (name: string) => ({ name, onChange: () => {}, onBlur: () => {}, ref: () => {} }),
        control: form.control,
        formState: { errors: hook.state.errors },
      },
      onSubmit: () => {},
      isPending: hook.state.isPending,
      result: hook.state.result,
    };
  },
}));

import { SignupForm } from "@/features/auth/components/signup-form";

const html = () => renderToStaticMarkup(createElement(SignupForm, null));

/** The sign up form as the sign up frame of the design draws it. */
describe("SignupForm", () => {
  beforeEach(() => {
    hook.state.isPending = false;
    hook.state.result = null;
    hook.state.errors = {};
  });

  it("should show the four fields with the labels of the design and a required mark on each", () => {
    const markup = html();

    for (const label of ["Full name", "Work email", "Password", "Confirm password"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('for="full_name"');
    expect(markup).toContain('for="email"');
    expect(markup).toContain('for="password"');
    expect(markup).toContain('for="confirm_password"');
    expect(markup.match(/aria-hidden="true">\*</g)).toHaveLength(4);
  });

  it("should show the password hint and tie it to the password field", () => {
    const markup = html();

    expect(markup).toContain("At least 12 characters, including a number and symbol.");
    expect(markup).toContain('aria-describedby="password-hint"');
    expect(markup).toContain('id="password-hint"');
  });

  it("should show the agree box with a label that points to it", () => {
    const markup = html();

    expect(markup).toContain('for="accepted_terms"');
    expect(markup).toContain("I agree to the Terms of Service and Privacy Policy.");
  });

  it("should show a submit button as wide as its label, and the sign in link after the question", () => {
    const markup = html();

    expect(markup).toContain(">Create account</button>");
    expect(markup).toContain("self-start");
    expect(markup.indexOf("Already have an account?")).toBeLessThan(markup.indexOf('href="/login"'));
  });

  it("should show a message under the agree box when it is not ticked", () => {
    hook.state.errors = { accepted_terms: { message: "Agree to the Terms of Service and Privacy Policy to continue." } };

    expect(html()).toContain("Agree to the Terms of Service and Privacy Policy to continue.");
  });

  it("should show the reason and keep the form when the sign up is refused", () => {
    hook.state.result = { success: false, message: "Something went wrong. Please try again." };

    const markup = html();

    expect(markup).toContain("Could not sign up");
    expect(markup).toContain('id="full_name"');
  });

  it("should show only the check your email message after a successful sign up", () => {
    hook.state.result = { success: true, message: "Check your email to confirm your account before signing in." };

    const markup = html();

    expect(markup).toContain("Check your email");
    expect(markup).not.toContain('id="full_name"');
  });

  it("should say Creating account... and disable the fields while the sign up is under way", () => {
    hook.state.isPending = true;

    const markup = html();

    expect(markup).toContain("Creating account...");
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
