import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runClientAction } from "@/lib/actions/run-client-action";
import { ISSUE_NETWORK_ERROR, NETWORK_ERROR } from "@/features/invoices/lib/invoice-errors";

/**
 * VI-F09-S12 (spec E8, E9): what happens when an invoice is saved and the network fails, or when the permission is lost
 * while the screen is open. The checks on the source are the same as the ones VI-F04-S17 makes for the other finance
 * forms; the others run the same helper with the errors of the invoices.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const INVOICE_ACTIONS = [
  "src/features/invoices/actions/generate-invoice.action.ts",
  "src/features/invoices/actions/issue-invoice.action.ts",
  "src/features/invoices/actions/update-invoice-status.action.ts",
];

const INVOICE_HOOKS = [
  "src/features/invoices/hooks/use-generate-invoice-form.ts",
  "src/features/invoices/hooks/use-issue-invoice.ts",
  "src/features/invoices/hooks/use-update-invoice-status.ts",
];

/** What Next throws for `forbidden()`: an error whose digest starts with `NEXT_`. */
const signal = () => Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;403"), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" });

describe("a user who lost the permission is stopped before anything is read (VI-F09-S12, AC02, E9)", () => {
  it.each(INVOICE_ACTIONS)("should check that the user is an admin before %s touches the database", (path) => {
    const source = read(path);
    const role = source.indexOf('requireRole(["admin"])');
    const database = Math.min(
      ...["createClient(", ".rpc(", ".from("].map((call) => source.indexOf(call)).filter((index) => index !== -1),
    );

    expect(role).toBeGreaterThan(-1);
    expect(role).toBeLessThan(database);
  });

  it.each(INVOICE_ACTIONS)("should send the user to the forbidden state when the database refuses in %s", (path) => {
    const source = read(path);
    const refusal = source.indexOf('error?.code === "42501"');
    const mapping = source.search(/error: map\w+Error\(/);

    expect(refusal).toBeGreaterThan(-1);
    expect(source.slice(refusal, mapping)).toContain("forbidden();");
  });

  it("should let the forbidden signal of an invoice action reach the framework, not turn it into a network message", async () => {
    await expect(
      runClientAction(async () => {
        throw signal();
      }, NETWORK_ERROR),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  });
});

describe("an invoice form keeps what was entered when the network fails (VI-F09-S12, AC01, E8)", () => {
  it.each(INVOICE_HOOKS)("should run the action of %s through runClientAction and catch nothing itself", (path) => {
    const source = read(path);

    expect(source).toContain("runClientAction(");
    expect(source).toMatch(/NETWORK_ERROR/);
    // A catch of its own would swallow the signal of Next that sends a user without the permission away.
    expect(source).not.toMatch(/\bcatch\b/);
  });

  it("should not reset the Generate invoice form, nor clear the Update status entries, when the action fails", () => {
    expect(read(INVOICE_HOOKS[0])).not.toContain("form.reset(");

    const update = read(INVOICE_HOOKS[2]);
    const failure = update.slice(update.indexOf("} else {"));

    expect(failure).not.toMatch(/reset\(|setStatus\(null\)|setReason\(""\)/);
  });

  it.each([
    ["Generate invoice and Update status", NETWORK_ERROR],
    ["Issue invoice", ISSUE_NETWORK_ERROR],
  ])("should answer a call that did not get through with a network error, never a success, for %s", async (_name, error) => {
    const result = await runClientAction(async () => {
      throw new TypeError("Failed to fetch");
    }, error);

    expect(result).toEqual({ success: false, error });
    expect(error.code).toBe("NETWORK_ERROR");
  });

  it("should say the entries are kept where there are entries to keep, and show nothing raw", async () => {
    const result = await runClientAction(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    }, NETWORK_ERROR);

    expect(NETWORK_ERROR.message).toContain("Your entries are kept");
    expect(JSON.stringify(result)).not.toContain("10.0.0.5");
  });
});
