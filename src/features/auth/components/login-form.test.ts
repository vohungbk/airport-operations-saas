import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
  state: {
    isPending: false,
    formError: null as string | null,
    errors: {} as Record<string, { message: string }>,
  },
}));

vi.mock("@/features/auth/hooks/use-login-form", () => ({
  useLoginForm: () => ({
    form: {
      register: (name: string) => ({ name, onChange: () => {}, onBlur: () => {}, ref: () => {} }),
      formState: { errors: hook.state.errors },
    },
    onSubmit: () => {},
    isPending: hook.state.isPending,
    formError: hook.state.formError,
  }),
}));

import { LoginForm } from "@/features/auth/components/login-form";

const html = () => renderToStaticMarkup(createElement(LoginForm, null));

/** The sign in form as the sign in frame of the design draws it. */
describe("LoginForm", () => {
  beforeEach(() => {
    hook.state.isPending = false;
    hook.state.formError = null;
    hook.state.errors = {};
  });

  it("should show the email and password fields with a required mark and a label that points to each", () => {
    const markup = html();

    expect(markup).toContain('for="email"');
    expect(markup).toContain('for="password"');
    expect(markup).toContain("Email address");
    expect(markup).toContain("Password");
    expect(markup.match(/aria-hidden="true">\*</g)).toHaveLength(2);
    expect(markup.match(/aria-required="true"/g)).toHaveLength(2);
  });

  it("should show a submit button as wide as its label, not the full width", () => {
    const markup = html();

    expect(markup).toContain(">Sign in</button>");
    expect(markup).toContain("self-start");
    expect(markup).not.toContain("w-full min-h-11");
  });

  it("should show the two links on one line, with Forgot password? before Create an account", () => {
    const markup = html();

    expect(markup).toContain('href="/forgot-password"');
    expect(markup).toContain('href="/signup"');
    expect(markup.indexOf("Forgot password?")).toBeLessThan(markup.indexOf("Create an account"));
    expect(markup).not.toContain("Don&#x27;t have an account?");
  });

  it("should show the links without an underline, as the frame draws them", () => {
    expect(html()).toContain("no-underline");
  });

  it("should draw the focus of a control as a visible focus-ring edge", () => {
    expect(html()).toContain("focus-visible:border-focus-ring");
  });

  it("should show the reason and keep the form when the sign in is refused", () => {
    hook.state.formError = "Wrong email or password.";

    const markup = html();

    expect(markup).toContain("Could not sign in");
    expect(markup).toContain("Wrong email or password.");
    expect(markup).toContain('id="email"');
  });

  it("should show a message under a field that is invalid", () => {
    hook.state.errors = { email: { message: "Enter a valid email" } };

    const markup = html();

    expect(markup).toContain("Enter a valid email");
    expect(markup).toContain('aria-invalid="true"');
  });

  it("should disable both fields and say Signing in... while the sign in is under way", () => {
    hook.state.isPending = true;

    const markup = html();

    expect(markup).toContain("Signing in...");
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
