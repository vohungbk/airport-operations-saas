import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AppError from "@/app/error";

describe("AppError", () => {
  it("should offer a retry and not call the failure forbidden", () => {
    const html = renderToStaticMarkup(
      createElement(AppError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load this page");
    expect(html).toContain("Try again");
    expect(html.toLowerCase()).not.toContain("forbidden");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(AppError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
