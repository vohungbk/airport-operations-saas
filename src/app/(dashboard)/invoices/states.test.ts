import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import InvoicesError from "@/app/(dashboard)/invoices/error";
import InvoicesForbidden from "@/app/(dashboard)/invoices/forbidden";
import InvoicesLoading from "@/app/(dashboard)/invoices/loading";

describe("the states of the invoice list (VI-F09-S01, AC01)", () => {
  it("should show a loading state the screen reader can tell from the page", () => {
    const html = renderToStaticMarkup(createElement(InvoicesLoading));

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
  });

  it("should say the invoices could not be loaded, offer a retry and never show the raw error", () => {
    const html = renderToStaticMarkup(
      createElement(InvoicesError, { error: new Error("connection to db.internal:5432 refused"), reset: vi.fn() }),
    );

    expect(html).toContain("Could not load invoices");
    expect(html).toContain("Try again");
    expect(html).not.toContain("db.internal");
  });

  it("should say who may open the invoices and lead back to the dashboard, without naming a permission", () => {
    const html = renderToStaticMarkup(createElement(InvoicesForbidden));

    expect(html).toContain("You do not have access to invoices.");
    expect(html).toContain("Invoices are available to Partner Users, Admins, and Operations Managers.");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Back to dashboard");
    expect(html).not.toContain("finance:");
  });
});
