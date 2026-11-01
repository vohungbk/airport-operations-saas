import { describe, expect, it } from "vitest";

import { INVOICE_STATUSES } from "@/features/invoices/lib/invoice-list";
import { allowedMoves, canMove, moveError, reasonRequired } from "@/features/invoices/lib/invoice-status";

describe("the moves of the payment status (VI-F09-S08, spec F1, V1)", () => {
  it.each([
    ["issued", "paid"],
    ["issued", "overdue"],
    ["issued", "void"],
    ["overdue", "paid"],
    ["overdue", "void"],
  ] as const)("should allow %s to %s (AC02)", (from, to) => {
    expect(canMove(from, to)).toBe(true);
    expect(moveError(from, to)).toBeNull();
  });

  it.each([
    ["paid", "issued"],
    ["paid", "void"],
    ["void", "issued"],
    ["void", "paid"],
    ["overdue", "issued"],
    ["issued", "draft"],
    ["draft", "paid"],
    ["draft", "issued"],
  ] as const)("should refuse %s to %s with a clear message (AC04)", (from, to) => {
    expect(canMove(from, to)).toBe(false);
    expect(moveError(from, to)).toBe(`An invoice that is ${from} cannot be changed to ${to}.`);
  });

  it.each(INVOICE_STATUSES)("should not offer the status %s as a move to itself", (status) => {
    expect(allowedMoves(status)).not.toContain(status);
    expect(canMove(status, status)).toBe(false);
  });

  it.each([["paid"], ["void"], ["draft"]] as const)("should offer no move for an invoice that is %s", (status) => {
    expect(allowedMoves(status)).toEqual([]);
  });

  it("should need a reason for a void only (AC05)", () => {
    expect(INVOICE_STATUSES.filter(reasonRequired)).toEqual(["void"]);
  });
});
