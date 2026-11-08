import { describe, expect, it, vi } from "vitest";

import { EXPORT_FAILED_MESSAGE, buildReportHref, requestReport } from "@/features/kpi/lib/download-report";

describe("buildReportHref (VI-F05-T03)", () => {
  it("should carry the period of the screen, and the search and the comparison only when they are set", () => {
    expect(buildReportHref("/api/reports/kpi", { period: "2026-10", compare_on: true, query: "" })).toBe("/api/reports/kpi?period=2026-10");
    expect(buildReportHref("/api/reports/roi", { period: "ytd", compare_on: false, query: "seat fulfilment" })).toBe(
      "/api/reports/roi?period=ytd&compare=off&q=seat+fulfilment",
    );
  });
});

describe("requestReport (VI-F05-T03, AC08)", () => {
  it("should give the file and its name when the export works", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("a,b", { status: 200, headers: { "content-disposition": 'attachment; filename="kpi-report-2026-10.csv"' } }),
    );

    const result = await requestReport("/api/reports/kpi?period=2026-10", fetcher);

    expect(result).toMatchObject({ ok: true, file_name: "kpi-report-2026-10.csv" });
  });

  it("should give the message of the standardized error when the export is refused", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: { code: "INTERNAL_ERROR", message: "Try later" } }, { status: 500 }));

    expect(await requestReport("/x", fetcher)).toEqual({ ok: false, message: "Try later" });
  });

  it("should give the plain message when the answer is not the error shape or the network fails, so the user can retry", async () => {
    expect(await requestReport("/x", vi.fn().mockResolvedValue(new Response("boom", { status: 502 })))).toEqual({
      ok: false,
      message: EXPORT_FAILED_MESSAGE,
    });
    expect(await requestReport("/x", vi.fn().mockRejectedValue(new Error("offline")))).toEqual({ ok: false, message: EXPORT_FAILED_MESSAGE });
  });
});
