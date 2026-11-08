export const EXPORT_FAILED_MESSAGE = "The report could not be exported. Please try again.";

export type ReportDownload = { ok: true; blob: Blob; file_name: string } | { ok: false; message: string };

/**
 * The address of a report: the period and the search the screen shows, so the file holds what the screen holds.
 * The comparison is carried only when it is off, as the picker carries it.
 */
export function buildReportHref(path: string, { period, compare_on, query }: { period: string; compare_on: boolean; query: string }): string {
  const params = new URLSearchParams({ period });
  if (!compare_on) params.set("compare", "off");
  if (query) params.set("q", query);

  return `${path}?${params.toString()}`;
}

function fileNameOf(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "");

  return match?.[1] ?? fallback;
}

/** The message of the standardized error body, or the plain one when the body is not that shape. */
async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { error?: { message?: unknown } }).error?.message;

    return typeof message === "string" && message ? message : EXPORT_FAILED_MESSAGE;
  } catch {
    return EXPORT_FAILED_MESSAGE;
  }
}

/** Client side (VI-F05-T03, AC08). Asks for the file; a refusal or a network failure is a message to show, never a throw, so the user can retry. */
export async function requestReport(href: string, fetcher: typeof fetch = fetch): Promise<ReportDownload> {
  try {
    const response = await fetcher(href, { credentials: "same-origin" });
    if (!response.ok) return { ok: false, message: await errorMessageOf(response) };

    return { ok: true, blob: await response.blob(), file_name: fileNameOf(response, "report.csv") };
  } catch {
    return { ok: false, message: EXPORT_FAILED_MESSAGE };
  }
}
