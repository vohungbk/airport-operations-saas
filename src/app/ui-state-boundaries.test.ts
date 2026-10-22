import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * VI-F08-S07 (spec R7): every loading, error and not-found state of the app renders,
 * and says what it must. They are all built on the shared states
 * (src/components/shared), so this proves each file is wired to them: a loading
 * state is announced as busy, an error state offers a retry and never shows the
 * error that caused it, and a not-found state says so and leads back.
 */
const modules = import.meta.glob("./**/{loading,error,not-found}.tsx", { eager: true }) as unknown as Record<
  string,
  { default: ComponentType<Record<string, unknown>> }
>;

const named = (suffix: string) =>
  Object.entries(modules)
    .filter(([path]) => path.endsWith(`/${suffix}.tsx`))
    .map(([path, module]) => [path.replace("./", ""), module.default] as const);

const CAUSE = "LEAK-relation users does not exist at 10.0.0.5";
const failure = Object.assign(new Error(CAUSE), { digest: "digest-1" });

describe("the boundary files of src/app", () => {
  it("should find the boundary files it is meant to check", () => {
    expect(named("loading").length).toBeGreaterThanOrEqual(14);
    expect(named("error").length).toBeGreaterThanOrEqual(15);
    expect(named("not-found").length).toBeGreaterThanOrEqual(2);
  });

  it.each(named("loading"))("should announce %s as busy, with a name, so a screen reader says it is loading", (_path, Loading) => {
    const html = renderToStaticMarkup(createElement(Loading));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading"');
  });

  it.each(named("error"))("should offer a retry in %s, and never show the error that caused it", (_path, ErrorState) => {
    const html = renderToStaticMarkup(createElement(ErrorState, { error: failure, reset: () => {} }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("LEAK");
    expect(html).not.toContain("relation");
    expect(html).not.toContain("10.0.0.5");
    expect(html).not.toContain("digest-1");
  });

  it.each(named("not-found"))("should say in %s that the page was not found, and lead back", (_path, NotFound) => {
    const html = renderToStaticMarkup(createElement(NotFound));

    expect(html).toMatch(/<h1[^>]*>[^<]*not found[^<]*<\/h1>/i);
    expect(html).toMatch(/<a [^>]*href="\/[^"]*"/);
  });
});
