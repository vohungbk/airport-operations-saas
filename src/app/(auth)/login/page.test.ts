import { isValidElement, type ReactElement } from "react";
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
