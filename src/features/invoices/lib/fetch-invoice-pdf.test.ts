import { describe, expect, it, vi } from "vitest";

import { fetchInvoicePdf } from "@/features/invoices/lib/fetch-invoice-pdf";

const ID = "d9100000-0000-0000-0000-000000000001";

const answer = (init: { status?: number; body?: BodyInit | null; headers?: HeadersInit }) =>
  vi.fn<typeof fetch>(async () => new Response(init.body ?? null, { status: init.status ?? 200, headers: init.headers }));

describe("fetchInvoicePdf (VI-F09-S04, AC01, AC04)", () => {
  it("should give the file when the route answers", async () => {
    const fetcher = answer({ body: "%PDF-1.7", headers: { "Content-Type": "application/pdf" } });

    const result = await fetchInvoicePdf(ID, fetcher);

    expect(result.ok).toBe(true);
    expect(result.ok && (await result.blob.text())).toBe("%PDF-1.7");
    expect(fetcher).toHaveBeenCalledWith(`/api/invoices/${ID}/pdf`, { cache: "no-store" });
  });

  it("should say what the route said when it refuses, so the screen can show it", async () => {
    const fetcher = answer({
      status: 403,
      body: JSON.stringify({ error: { code: "FORBIDDEN", message: "You cannot download this invoice." } }),
    });

    await expect(fetchInvoicePdf(ID, fetcher)).resolves.toEqual({ ok: false, message: "You cannot download this invoice." });
  });

  it("should give a generic message, never the raw body, when the answer is not the standard error", async () => {
    const result = await fetchInvoicePdf(ID, answer({ status: 500, body: "<html>db.internal:5432 refused</html>" }));

    expect(result).toEqual({ ok: false, message: "Could not build the PDF. Please try again." });
  });

  it("should give a message, not a throw, when the network is down", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(fetchInvoicePdf(ID, fetcher)).resolves.toEqual({
      ok: false,
      message: "Could not reach the server. Please try again.",
    });
  });

  it("should keep an id that is not a uuid from changing the address", async () => {
    const fetcher = answer({ body: "x" });

    await fetchInvoicePdf("a/../b?x=1", fetcher);

    expect(String(fetcher.mock.calls[0][0])).toBe("/api/invoices/a%2F..%2Fb%3Fx%3D1/pdf");
  });
});
