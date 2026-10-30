import { describe, expect, it } from "vitest";

import {
  INVOICES_INTERNAL_PAGE_SIZE,
  INVOICES_PARTNER_PAGE_SIZE,
  invoicesQuerySchema,
  resolveInvoicesQuery,
} from "@/features/invoices/schemas/invoices-query.schema";

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";

describe("invoicesQuerySchema (VI-F09-S01)", () => {
  it("should default to the due date, newest first, page 1 and no filter", () => {
    expect(invoicesQuerySchema.parse({})).toEqual({
      q: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      partner_id: undefined,
      sort: "due_date",
      order: "desc",
      page: 1,
      page_size: undefined,
    });
  });

  it("should read every filter the screen has", () => {
    const query = invoicesQuerySchema.parse({
      q: " INV-2026 ",
      status: "overdue",
      from: "2026-01",
      to: "2026-10",
      partner_id: PARTNER_ID,
      sort: "amount",
      order: "asc",
      page: "3",
      page_size: "25",
    });

    expect(query).toMatchObject({ q: "INV-2026", status: "overdue", from: "2026-01", to: "2026-10", partner_id: PARTNER_ID, sort: "amount", order: "asc", page: 3, page_size: 25 });
  });

  it.each([
    ["a sort column that is not allowed", { sort: "id; drop table invoices" }, "sort", "due_date"],
    ["an order that is not asc or desc", { order: "sideways" }, "order", "desc"],
    ["a page below 1", { page: "0" }, "page", 1],
    ["a page that is not a number", { page: "abc" }, "page", 1],
    ["a page size that is not one of the three", { page_size: "1000" }, "page_size", undefined],
    ["a month that is not YYYY-MM", { from: "2026-13" }, "from", undefined],
    ["a status that does not exist", { status: "refunded" }, "status", undefined],
    ["a partner id that is not a uuid", { partner_id: "x" }, "partner_id", undefined],
    ["a search that is too long", { q: "x".repeat(41) }, "q", undefined],
  ])("should fall back to a safe default for %s", (_name, raw, key, expected) => {
    expect(invoicesQuerySchema.parse(raw)[key as keyof ReturnType<typeof invoicesQuerySchema.parse>]).toEqual(expected);
  });
});

describe("resolveInvoicesQuery", () => {
  const query = invoicesQuerySchema.parse({ partner_id: PARTNER_ID, status: "draft" });

  it("should give a partner user 10 rows a page, and an operations user 25", () => {
    expect(resolveInvoicesQuery(query, true).page_size).toBe(INVOICES_PARTNER_PAGE_SIZE);
    expect(resolveInvoicesQuery(query, false).page_size).toBe(INVOICES_INTERNAL_PAGE_SIZE);
  });

  it("should keep the page size the user chose", () => {
    expect(resolveInvoicesQuery(invoicesQuerySchema.parse({ page_size: "50" }), true).page_size).toBe(50);
  });

  it("should drop the partner a partner user names in the address, and keep it for an operations user", () => {
    expect(resolveInvoicesQuery(query, true)).not.toHaveProperty("partner_id");
    expect(resolveInvoicesQuery(query, false).partner_id).toBe(PARTNER_ID);
  });

  it("should drop a draft or void status for a partner user, who is not shown those invoices", () => {
    expect(resolveInvoicesQuery(query, true).status).toBeUndefined();
    expect(resolveInvoicesQuery(query, false).status).toBe("draft");
  });
});
