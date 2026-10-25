import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { CountBadge } from "@/components/layout/count-badge";
import { isTruncated } from "@/components/layout/use-is-truncated";

const LAYOUT_DIR = join(process.cwd(), "src", "components", "layout");
const read = (name: string) => readFileSync(join(LAYOUT_DIR, name), "utf8");

describe("top bar", () => {
  const topBar = read("top-bar.tsx");

  it("should show only from the md breakpoint, on the wide screens, and stay off the printed page", () => {
    expect(topBar).toMatch(/<header className="hidden [^"]*md:flex print:hidden"/);
  });

  it("should hold the breadcrumb, the theme control and the account menu", () => {
    expect(topBar).toContain("<Breadcrumb");
    expect(topBar).toContain("<ThemeControl />");
    expect(topBar).toContain("<UserMenu");
  });

  it("should be 44 px high", () => {
    expect(topBar).toContain("h-11");
  });
});

describe("app shell and the top bar", () => {
  const shell = read("app-shell.tsx");

  it("should put the top bar above the content, in the column next to the sidebar", () => {
    expect(shell).toMatch(/<TopBar[\s\S]*<main/);
  });

  it("should give the top bar the role as words", () => {
    expect(shell).toContain("role_label: ROLE_LABELS[user.role]");
  });
});

describe("account menu", () => {
  const menu = read("user-menu.tsx");

  it("should show the name, the role and the email, and Sign out", () => {
    expect(menu).toContain("{full_name}");
    expect(menu).toContain("{role_label}");
    expect(menu).toContain("{email}");
    expect(menu).toContain('"Sign out"');
  });

  it("should name its button for assistive technology", () => {
    expect(menu).toContain("aria-label={`Account menu, ${full_name}`}");
  });

  it("should sign out with the existing server action", () => {
    expect(menu).toContain("logoutAction()");
  });
});

describe("breadcrumb component", () => {
  const breadcrumb = read("breadcrumb.tsx");

  it("should be a labelled landmark with a home link and the current page marked", () => {
    expect(breadcrumb).toContain('<nav aria-label="Breadcrumb"');
    expect(breadcrumb).toContain('aria-label="Home"');
    expect(breadcrumb).toContain('aria-current={index === crumbs.length - 1 ? "page" : undefined}');
  });

  it("should send the home link to the dashboard route, which every role shares", () => {
    expect(breadcrumb).toContain("href={DASHBOARD_ROUTE}");
  });

  it("should cut a long crumb and keep its text as the title", () => {
    expect(breadcrumb).toContain("title={crumb.label}");
    expect(breadcrumb).toContain("truncate");
  });
});

describe("count badge", () => {
  const html = (count: number) => renderToStaticMarkup(createElement(CountBadge, { count }));

  it("should show the number", () => {
    expect(html(7)).toContain(">7<");
  });

  it("should show 99+ for a large count and keep the real number as the title", () => {
    const markup = html(250);

    expect(markup).toContain(">99+<");
    expect(markup).toContain('title="250"');
  });

  it("should show nothing for zero", () => {
    expect(html(0)).toBe("");
  });
});

describe("isTruncated", () => {
  it("should be true when the text is wider than the box", () => {
    expect(isTruncated({ scrollWidth: 240, clientWidth: 200 })).toBe(true);
  });

  it("should be false when the text fits", () => {
    expect(isTruncated({ scrollWidth: 200, clientWidth: 200 })).toBe(false);
    expect(isTruncated({ scrollWidth: 120, clientWidth: 200 })).toBe(false);
  });
});
