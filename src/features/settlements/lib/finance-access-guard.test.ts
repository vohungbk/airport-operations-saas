import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F04-S15 (spec R18, E9): the code side of the finance isolation. The database decides what a user may
 * read (see `finance-access-matrix.integration.test.ts`); these checks keep the code from asking for more:
 * no finance page or read takes a partner from the request, no finance code holds a service-role key, and
 * the actions that write finance check the role before they touch the database.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const PARTNER_FINANCE_READS = [
  "src/app/(partner)/partner/finance/page.tsx",
  "src/features/partners/lib/get-partner-finance.ts",
  "src/app/(dashboard)/settlements/page.tsx",
  "src/features/settlements/lib/get-settlements.ts",
  "src/app/(dashboard)/bookings/[id]/revenue/page.tsx",
  "src/app/(dashboard)/invoices/[id]/page.tsx",
  "src/features/invoices/lib/get-invoice.ts",
  "src/app/api/invoices/[id]/pdf/route.ts",
];

const FINANCE_CODE = [
  ...PARTNER_FINANCE_READS,
  "src/features/partners/lib/partner-finance.ts",
  "src/features/settlements/actions/generate-settlement.action.ts",
  "src/features/settlements/actions/move-settlement-status.action.ts",
  "src/features/bookings/lib/get-booking-revenue.ts",
  "src/app/(dashboard)/invoices/page.tsx",
  "src/features/invoices/lib/get-invoices.ts",
  "src/app/api/invoices/export/route.ts",
  "src/features/invoices/lib/invoices-csv.ts",
  "src/features/invoices/lib/invoice-pdf.ts",
];

describe("finance reads leave the scope to RLS", () => {
  it.each(PARTNER_FINANCE_READS)("should not filter %s by a partner id of its own", (path) => {
    const source = read(path);

    expect(source).not.toMatch(/\.eq\(\s*["']partner_id["']/);
    expect(source).not.toMatch(/\.match\(\s*\{[^}]*partner_id/);
  });

  it.each([
    "src/app/(partner)/partner/finance/page.tsx",
    "src/app/(dashboard)/settlements/page.tsx",
  ])("should not read the address or the form in %s", (path) => {
    const source = read(path);

    expect(source).not.toMatch(/searchParams|params\b|formData|request\./);
  });

  it("should give the partner finance page no way to name a partner", () => {
    const source = read("src/app/(partner)/partner/finance/page.tsx");

    expect(source).toContain('requirePartnerScope("finance:view_own_partner")');
    expect(source).toContain("getPartnerFinance()");
  });
});

describe("finance code holds no service-role key", () => {
  it.each(FINANCE_CODE)("should not use the service role in %s", (path) => {
    expect(read(path)).not.toMatch(/service[_-]?role|SERVICE_ROLE/i);
  });
});

describe("the actions that write finance check the role first", () => {
  it.each([
    "src/features/settlements/actions/generate-settlement.action.ts",
    "src/features/settlements/actions/move-settlement-status.action.ts",
  ])("should check that the user is an admin before %s reads or writes anything", (path) => {
    const source = read(path);
    const role = source.indexOf('requireRole(["admin"])');
    const database = Math.min(
      ...["createClient(", ".rpc(", ".from("]
        .map((call) => source.indexOf(call))
        .filter((index) => index !== -1),
    );

    expect(role).toBeGreaterThan(-1);
    expect(role).toBeLessThan(database);
  });
});

const FINANCE_WRITE_ACTIONS = [
  "src/features/settlements/actions/generate-settlement.action.ts",
  "src/features/settlements/actions/move-settlement-status.action.ts",
  "src/features/partners/actions/save-commercial-terms.action.ts",
  "src/features/bookings/actions/record-adjustment.action.ts",
];

const FINANCE_FORM_HOOKS = [
  "src/features/settlements/hooks/use-generate-settlement-form.ts",
  "src/features/settlements/hooks/use-move-settlement-status.ts",
  "src/features/partners/hooks/use-commercial-terms-form.ts",
  "src/features/bookings/hooks/use-adjustment-form.ts",
];

describe("a user who lost the permission is stopped before anything is read (VI-F04-S17, E11)", () => {
  it.each(FINANCE_WRITE_ACTIONS)("should check the role or the permission first in %s", (path) => {
    const source = read(path);
    const guard = source.search(/await require(Role|Permission|AnyPermission)\(/);
    const database = Math.min(
      ...["getBookingRevenue(", "createClient(", ".rpc(", ".from("]
        .map((call) => source.indexOf(call))
        .filter((index) => index !== -1),
    );

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(database);
  });
});

describe("a finance form keeps what was entered when the network fails (VI-F04-S17, E10)", () => {
  it.each(FINANCE_FORM_HOOKS)("should run the action of %s through runClientAction and catch nothing itself", (path) => {
    const source = read(path);

    expect(source).toContain("runClientAction(");
    expect(source).toContain("NETWORK_ERROR");
    // A catch of its own would swallow the signal of Next that sends a user without the permission away.
    expect(source).not.toMatch(/\bcatch\b/);
  });

  it.each(FINANCE_FORM_HOOKS)("should not reset the form when the action fails in %s", (path) => {
    const source = read(path);
    const resets = source.match(/form\.reset\(/g) ?? [];

    // Only the terms form resets, and only after a success.
    expect(resets.length).toBeLessThanOrEqual(1);
    if (resets.length === 1) {
      expect(source).toMatch(/if \(outcome\.success\) \{\s*form\.reset\(/);
    }
  });
});
