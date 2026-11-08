import { describe, expect, it } from "vitest";

import { REPORT_NO_DATA_NOTE, buildReportCsv, reportFileName, type ReportMeta, type ReportRow } from "@/features/kpi/lib/report-csv";

const META: ReportMeta = {
  title: "KPI report",
  scope_label: "Emirates Rent A Car",
  period_label: "October 2026",
  exported_at: "2026-11-09T10:00:00.000Z",
  exported_by: "Nadia Hassan",
};

const row = (overrides: Partial<ReportRow> = {}): ReportRow => ({
  section: "Core programme KPIs",
  type: "Verified",
  figure: "Correct-seat fulfilment",
  value: "99.2%",
  detail: "238 / 240",
  ...overrides,
});

const linesOf = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

describe("buildReportCsv (VI-F05-T03)", () => {
  it("should say what, for whom, which period, when and by whom before the figures (AC01)", () => {
    const lines = linesOf(buildReportCsv(META, [row()], false));

    expect(lines.slice(0, 5)).toEqual([
      "Report,KPI report",
      "Scope,Emirates Rent A Car",
      "Period,October 2026",
      "Exported at,2026-11-09T10:00:00.000Z",
      "Exported by,Nadia Hassan",
    ]);
    expect(lines).toContain("Section,Type,Figure,Value,Detail");
    expect(lines).toContain("Core programme KPIs,Verified,Correct-seat fulfilment,99.2%,238 / 240");
  });

  it("should keep the verified rows before the estimate rows, each with its type (AC03)", () => {
    const csv = buildReportCsv(
      { ...META, title: "ROI report" },
      [row({ type: "Estimate", figure: "Estimate · Avoided handling" }), row({ figure: "Verified refunds" })],
      false,
    );
    const body = linesOf(csv);

    expect(body.findIndex((line) => line.includes(",Verified,"))).toBeLessThan(body.findIndex((line) => line.includes(",Estimate,")));
  });

  it.each(["No data", "Not available"])("should write %s as the value and never turn it into 0 (AC04)", (value) => {
    const csv = buildReportCsv(META, [row({ value, detail: "" })], false);

    expect(csv).toContain(`,${value},`);
    expect(csv).not.toMatch(/,0,/);
  });

  it("should still give the header and a No data note when the period has nothing (AC06)", () => {
    const lines = linesOf(buildReportCsv(META, [row({ value: "No data" })], true));

    expect(lines).toContain("Section,Type,Figure,Value,Detail");
    expect(lines).toContain(`Note,${REPORT_NO_DATA_NOTE}`);
  });

  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx"])("should escape a cell that starts with %j so a spreadsheet does not run it (AC07)", (cell) => {
    const csv = buildReportCsv({ ...META, exported_by: cell }, [row({ figure: cell, detail: cell })], false);

    expect(csv).toContain(`Exported by,'${cell}`);
    expect(csv).toContain(`,'${cell},99.2%,'${cell}`);
  });

  it("should quote a cell with a comma or a quote", () => {
    expect(buildReportCsv(META, [row({ detail: 'a, "b"' })], false)).toContain('"a, ""b"""');
  });

  it("should start with the byte order mark so Excel keeps an accent", () => {
    expect(buildReportCsv(META, [], false).startsWith("﻿")).toBe(true);
  });

  it("should name the file after the kind and the period", () => {
    expect(reportFileName("kpi", "2026-10")).toBe("kpi-report-2026-10.csv");
    expect(reportFileName("roi", "ytd")).toBe("roi-report-ytd.csv");
  });
});
