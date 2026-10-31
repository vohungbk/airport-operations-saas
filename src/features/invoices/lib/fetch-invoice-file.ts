const NETWORK_ERROR = "Could not reach the server. Please try again.";

export type InvoiceFileResult = { ok: true; blob: Blob } | { ok: false; message: string };

/** The message of the standardized error body of the route, or the fallback when the body is not that. */
async function messageOf(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } }).error?.message;

    return typeof message === "string" && message ? message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Asks a route of an invoice for a file (VI-F09-S04, S05). A failure of the network or of the route is a result with
 * a message, never a throw, so the screen can show it and offer to try again. Nothing is written.
 */
export async function fetchInvoiceFile(
  path: string,
  fallbackMessage: string,
  fetcher: typeof fetch = fetch,
): Promise<InvoiceFileResult> {
  try {
    const response = await fetcher(path, { cache: "no-store" });

    return response.ok
      ? { ok: true, blob: await response.blob() }
      : { ok: false, message: await messageOf(response, fallbackMessage) };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}
