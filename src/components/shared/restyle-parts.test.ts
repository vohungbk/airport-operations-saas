import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AppError from "@/app/error";
import { PageError } from "@/components/shared/page-error";
import { PageMessage } from "@/components/shared/page-state";
import { TextLink } from "@/components/ui/text-link";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("TextLink (UI-F06-S01, R10)", () => {
  const link = () => html(createElement(TextLink, { href: "/login" }, "Sign in"));

  it("should keep the address and the words it is given", () => {
    const out = link();
    expect(out).toContain('href="/login"');
    expect(out).toContain("Sign in");
  });

  it("should be 44 px high on a touch screen, like the other controls", () => {
    expect(link()).toContain("pointer-coarse:min-h-11");
  });

  it("should be underlined, so it is not told from the text around it by color alone", () => {
    expect(link()).toContain("underline");
  });

  it("should take the class it is given, as in a smaller line of text", () => {
    expect(html(createElement(TextLink, { href: "/x", className: "text-sm" }, "x"))).toContain("text-sm");
  });
});

describe("PageError centered (the error at the root, R11)", () => {
  const centered = (props: object = {}) => html(createElement(PageError, { title: "Could not load this page", centered: true, ...props }));

  it("should be centered like the forbidden and not-found pages, with the title as the heading", () => {
    const out = centered();
    expect(out).toContain("<h1");
    expect(out).toContain("Could not load this page");
    expect(out).toContain("text-center");
    expect(out).toContain("justify-center");
  });

  it("should be announced as an alert", () => {
    expect(centered()).toContain('role="alert"');
  });

  it("should offer a retry when it is given one, and none when it is not", () => {
    expect(centered({ reset: () => {} })).toContain("Try again");
    expect(centered()).not.toContain("Try again");
  });

  it("should say the default sentence, not a raw error", () => {
    expect(centered()).toContain("Something went wrong. Please try again.");
  });

  it("should leave the error inside a shell as it was: an alert at the top of the content", () => {
    const inShell = html(createElement(PageError, { title: "Could not load seats", reset: () => {} }));
    expect(inShell).toContain("p-8");
    expect(inShell).not.toContain("<h1");
  });
});

describe("the error at the root", () => {
  it("should use the centered message", () => {
    const out = html(createElement(AppError, { error: new Error("x"), reset: vi.fn() }));
    expect(out).toContain("<h1");
    expect(out).toContain("justify-center");
    expect(out).toContain("Try again");
  });
});

describe("PageMessage", () => {
  it("should carry the role it is given and none otherwise", () => {
    expect(html(createElement(PageMessage, { title: "T", description: "D", role: "alert" }))).toContain('role="alert"');
    expect(html(createElement(PageMessage, { title: "T", description: "D" }))).not.toContain("role=");
  });
});
