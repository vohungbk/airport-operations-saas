const GENERIC_ERROR = "Could not build the PDF. Please try again.";
const NETWORK_ERROR = "Could not reach the server. Please try again.";

export type InvoicePdfResult = { ok: true; blob: Blob } | { ok: false; message: string };

/** The message of the standardized error body of the route, or a generic one when the body is not that. */
async function messageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } }).error?.message;

    return typeof message === "string" && message ? message : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

/**
 * Asks the route for the PDF of an invoice (VI-F09-S04). A failure of the network or of the route is a result
 * with a message, never a throw, so the screen can show it and offer to try again. Nothing is written: the
 * invoice is only read.
 */
export async function fetchInvoicePdf(
  invoiceId: string,
  fetcher: typeof fetch = fetch,
): Promise<InvoicePdfResult> {
  try {
    const response = await fetcher(`/api/invoices/${encodeURIComponent(invoiceId)}/pdf`, { cache: "no-store" });

    return response.ok ? { ok: true, blob: await response.blob() } : { ok: false, message: await messageOf(response) };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}
