import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/login-form", () => ({
  LoginForm: () => null,
}));

import LoginPage from "@/app/(auth)/login/page";
import { LoginForm } from "@/features/auth/components/login-form";

/** The `next` that the page hands to the form: the tree is searched, since the form sits in a card. */
function nextOf(node: unknown): string | undefined | "none" {
  if (!isValidElement(node)) return "none";
  const element = node as ReactElement<{ children?: unknown; next?: string }>;
  if (element.type === LoginForm) return element.props.next;
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  for (const child of children) {
    const found = nextOf(child);
    if (found !== "none") return found;
  }
  return "none";
}

const render = async (searchParams: Record<string, string | string[] | undefined>) =>
  nextOf(await LoginPage({ searchParams: Promise.resolve(searchParams) }));

/** The sign in frame of the design: the heading, the product name, the card and the footer line. */
describe("LoginPage frame", () => {
  const markup = async (params: Record<string, string | string[] | undefined> = {}) =>
    renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(params) }));

  it("should show one main heading, Sign in, with the line about secure access under it", async () => {
    const out = await markup();

    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain("Secure access to Airport Operations SaaS");
  });

  it("should show the product name with a plane icon that a screen reader skips", async () => {
    const out = await markup();

    expect(out).toContain("Airport Operations</p>");
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("should show the protected workspace line under the card", async () => {
    const out = await markup();

    expect(out).toContain("Protected workspace · Tenant-scoped access · © 2026 Airport Operations");
    expect(out.indexOf("Sign in</div>")).toBeLessThan(out.indexOf("Protected workspace"));
  });

  it("should not show the old line about signing in to the account", async () => {
    expect(await markup()).not.toContain("Sign in to your Airport Operations account.");
  });
});

/**
 * FO-F03-S11 (spec E11): the page to return to comes from the address, so only a safe
 * path of the app reaches the form.
 */
describe("LoginPage", () => {
  it("should give the form the page to return to when it is a path of the app", async () => {
    expect(await render({ next: "/seats/x/cleaning" })).toBe("/seats/x/cleaning");
  });

  it.each([
    ["an address of another site", { next: "https://evil.example" }],
    ["a scheme-relative address", { next: "//evil.example" }],
    ["the sign in page", { next: "/login" }],
    ["no address", {}],
    ["a list of addresses", { next: ["/seats", "/jobs"] }],
  ])("should give the form nothing for %s", async (_name, params) => {
    expect(await render(params)).toBeUndefined();
  });
});
