import { describe, expect, it, vi } from "vitest";

import { fetchInvoiceStatement } from "@/features/invoices/lib/fetch-invoice-statement";

const ID = "d9100000-0000-0000-0000-000000000001";

const answer = (init: { status?: number; body?: BodyInit | null }) =>
  vi.fn<typeof fetch>(async () => new Response(init.body ?? null, { status: init.status ?? 200 }));

describe("fetchInvoiceStatement (VI-F09-S05)", () => {
  it("should give the file when the route answers", async () => {
    const fetcher = answer({ body: "Booking number\r\n" });

    const result = await fetchInvoiceStatement(ID, fetcher);

    expect(result.ok && (await result.blob.text())).toBe("Booking number\r\n");
    expect(fetcher).toHaveBeenCalledWith(`/api/invoices/${ID}/statement`, { cache: "no-store" });
  });

  it("should say what the route said when it refuses, so the screen can show it", async () => {
    const fetcher = answer({
      status: 403,
      body: JSON.stringify({ error: { code: "FORBIDDEN", message: "You cannot download this statement." } }),
    });

    await expect(fetchInvoiceStatement(ID, fetcher)).resolves.toEqual({ ok: false, message: "You cannot download this statement." });
  });

  it("should give a generic message, never the raw body, when the answer is not the standard error", async () => {
    const result = await fetchInvoiceStatement(ID, answer({ status: 500, body: "<html>db.internal refused</html>" }));

    expect(result).toEqual({ ok: false, message: "Could not build the statement. Please try again." });
  });

  it("should give a message, not a throw, when the network is down", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(fetchInvoiceStatement(ID, fetcher)).resolves.toEqual({
      ok: false,
      message: "Could not reach the server. Please try again.",
    });
  });
});
