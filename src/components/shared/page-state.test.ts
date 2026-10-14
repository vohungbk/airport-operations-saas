import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageError } from "./page-error";
import {
  DEFAULT_EMPTY_MESSAGE,
  DEFAULT_FORBIDDEN_TITLE,
  DEFAULT_NOT_FOUND_TITLE,
  PageEmpty,
  PageForbidden,
  PageLoading,
  PageNotFound,
  PageSuccess,
} from "./page-state";

describe("shared page states", () => {
  it("should render the loading state as a busy status region", () => {
    const html = renderToStaticMarkup(createElement(PageLoading));

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it("should render the empty state with the given message", () => {
    const html = renderToStaticMarkup(
      createElement(PageEmpty, { message: "No seats found." }),
    );

    expect(html).toContain("No seats found.");
  });

  it("should render the success state with title and description", () => {
    const html = renderToStaticMarkup(
      createElement(PageSuccess, { title: "Saved", description: "All good." }),
    );

    expect(html).toContain("Saved");
    expect(html).toContain("All good.");
  });

  it("should render the error state with a retry button when reset is given", () => {
    const html = renderToStaticMarkup(
      createElement(PageError, { title: "Could not load seats", reset: () => {} }),
    );

    expect(html).toContain("Could not load seats");
    expect(html).toContain("Try again");
  });

  it("should render the forbidden state with default copy", () => {
    const html = renderToStaticMarkup(createElement(PageForbidden));

    expect(html).toContain(DEFAULT_FORBIDDEN_TITLE);
    expect(html).toContain("have permission to view this page");
  });

  it("should render the not-found state with a link back", () => {
    const html = renderToStaticMarkup(
      createElement(PageNotFound, { backHref: "/seats" }),
    );

    expect(html).toContain(DEFAULT_NOT_FOUND_TITLE);
    expect(html).toContain('href="/seats"');
  });

  it("should fall back to default copy when props are missing", () => {
    const empty = renderToStaticMarkup(createElement(PageEmpty));
    const error = renderToStaticMarkup(
      createElement(PageError, { title: "Could not load" }),
    );

    expect(empty).toContain(DEFAULT_EMPTY_MESSAGE);
    expect(error).toContain("Something went wrong");
    expect(error).not.toContain("Try again");
  });
});

describe("page state conventions", () => {
  function listFiles(dir: string, names: string[]): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listFiles(full, names);
      return names.includes(name) ? [full] : [];
    });
  }

  it("should use the shared components in every loading.tsx and error.tsx", () => {
    const files = listFiles(join(process.cwd(), "src", "app"), [
      "loading.tsx",
      "error.tsx",
    ]);
    const offenders = files.filter(
      (file) => !readFileSync(file, "utf8").includes("@/components/shared/"),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
