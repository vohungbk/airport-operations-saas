import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import DashboardError from "@/app/(dashboard)/dashboard/error";

describe("DashboardError", () => {
  it("should say the dashboard could not be loaded and offer a retry", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardError, { error: new Error("x"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load the dashboard");
    expect(html).toContain("Try again");
  });

  it("should never show the raw error message", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardError, {
        error: new Error("connection to db.internal:5432 refused"),
        reset: vi.fn(),
      }),
    );

    expect(html).not.toContain("db.internal");
  });
});
