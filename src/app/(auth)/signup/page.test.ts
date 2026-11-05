import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/signup-form", () => ({
  SignupForm: () => null,
}));

import SignupPage from "@/app/(auth)/signup/page";

/** The sign up frame of the design: the heading, the product name, the card and the footer line. */
describe("SignupPage", () => {
  const markup = () => renderToStaticMarkup(SignupPage());

  it("should show one main heading, Sign up, with the line about secure access under it", () => {
    const out = markup();

    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain("Sign up</h1>");
    expect(out).toContain("Secure access to Airport Operations SaaS");
  });

  it("should show the product name with a plane icon that a screen reader skips", () => {
    const out = markup();

    expect(out).toContain("Airport Operations</p>");
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("should show the protected workspace line under the card", () => {
    const out = markup();

    expect(out).toContain("Protected workspace · Tenant-scoped access · © 2026 Airport Operations");
    expect(out.indexOf("Sign up</div>")).toBeLessThan(out.indexOf("Protected workspace"));
  });

  it("should not show the theme control, as the design has none", () => {
    expect(markup()).not.toContain("Theme");
  });

  it("should not show the old line about starting to manage bookings", () => {
    expect(markup()).not.toContain("Sign up to start managing");
  });
});
