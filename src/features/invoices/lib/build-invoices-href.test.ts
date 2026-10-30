import { describe, expect, it } from "vitest";

import { buildInvoicesExportHref, buildInvoicesHref } from "@/features/invoices/lib/build-invoices-href";
import { invoicesQuerySchema, resolveInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

const query = resolveInvoicesQuery(invoicesQuerySchema.parse({ q: "INV", status: "paid", from: "2026-01", to: "2026-06", sort: "amount", order: "asc" }), false);

describe("buildInvoicesHref", () => {
  it("should keep every active filter and the sort in a link to another page", () => {
    const href = buildInvoicesHref(query, { page: 2 });
    const params = new URL(href, "http://x").searchParams;

    expect(href.startsWith("/invoices?")).toBe(true);
    expect(Object.fromEntries(params)).toMatchObject({ q: "INV", status: "paid", from: "2026-01", to: "2026-06", sort: "amount", order: "asc", page: "2", page_size: "25" });
  });

  it("should leave the page out when the sort or the size changes, so the list restarts at page 1", () => {
    const params = new URL(buildInvoicesHref({ ...query, page: 4 }, { sort: "due_date", order: "desc" }), "http://x").searchParams;

    expect(params.has("page")).toBe(false);
    expect(params.get("sort")).toBe("due_date");
  });

  it("should leave out a filter that is not set", () => {
    const params = new URL(buildInvoicesHref(resolveInvoicesQuery(invoicesQuerySchema.parse({}), true)), "http://x").searchParams;

    expect([...params.keys()].sort()).toEqual(["order", "page_size", "sort"]);
  });
});

describe("buildInvoicesExportHref (VI-F09-S02)", () => {
  it("should keep the filters and the sort of the list, and leave the page and the page size out", () => {
    const href = buildInvoicesExportHref({ ...query, page: 4 });
    const params = new URL(href, "http://x").searchParams;

    expect(href.startsWith("/api/invoices/export?")).toBe(true);
    expect(Object.fromEntries(params)).toEqual({ q: "INV", status: "paid", from: "2026-01", to: "2026-06", sort: "amount", order: "asc" });
  });

  it("should leave out a filter that is not set", () => {
    const params = new URL(buildInvoicesExportHref(resolveInvoicesQuery(invoicesQuerySchema.parse({}), true)), "http://x").searchParams;

    expect([...params.keys()].sort()).toEqual(["order", "sort"]);
  });
});
