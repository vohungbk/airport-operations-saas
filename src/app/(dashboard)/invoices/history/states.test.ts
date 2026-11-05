import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import InvoiceHistoryError from "@/app/(dashboard)/invoices/history/error";
import InvoiceHistoryLoading from "@/app/(dashboard)/invoices/history/loading";

describe("the states of the invoice history (VI-F09-S10, AC01)", () => {
  it("should show a loading state the screen reader can tell from the page", () => {
    const html = renderToStaticMarkup(createElement(InvoiceHistoryLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
  });

  it("should say the history could not be loaded, offer a retry and never show the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceHistoryError, { error: new Error("connection to db.internal:5432 refused"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load invoice history");
    expect(html).toContain("Try again");
    expect(html).not.toContain("db.internal");
  });
});
