import { CSV_BOM, EOL, textCell } from "@/features/invoices/lib/invoices-csv";

export const REPORT_NO_DATA_NOTE = "No data in this period.";

export interface ReportMeta {
  /** `KPI report` or `ROI report`. */
  title: string;
  /** Who the figures are about: the name of the partner, or all partners. */
  scope_label: string;
  period_label: string;
  /** When the file was made, as an ISO time. */
  exported_at: string;
  exported_by: string;
}

/** A verified figure is one counted from records; an estimate is modelled from the baseline and is never added to a verified total. */
export type ReportRowType = "Verified" | "Estimate";

export interface ReportRow {
  section: string;
  type: ReportRowType;
  figure: string;
  /** The value as the screen words it, so No data and Not available are never a 0 (R13). */
  value: string;
  detail: string;
}

const HEADER = ["Section", "Type", "Figure", "Value", "Detail"];

const line = (cells: readonly string[]) => cells.map(textCell).join(",");

/**
 * Pure (VI-F05-T03). The KPI or ROI report as a CSV file: a block that says what, for whom, which period, when
 * and by whom, then one row for each figure of the screen. Verified rows come before Estimate rows, so the two
 * stay apart. A period with no data still gives the header and a No data note. Every cell goes through
 * `textCell`, so a cell that starts with `=`, `+`, `-` or `@` is not run by a spreadsheet.
 */
export function buildReportCsv(meta: ReportMeta, rows: readonly ReportRow[], is_empty: boolean): string {
  const ordered = [...rows.filter((row) => row.type === "Verified"), ...rows.filter((row) => row.type === "Estimate")];

  const lines = [
    line(["Report", meta.title]),
    line(["Scope", meta.scope_label]),
    line(["Period", meta.period_label]),
    line(["Exported at", meta.exported_at]),
    line(["Exported by", meta.exported_by]),
    ...(is_empty ? [line(["Note", REPORT_NO_DATA_NOTE])] : []),
    "",
    line(HEADER),
    ...ordered.map((row) => line([row.section, row.type, row.figure, row.value, row.detail])),
  ];

  return CSV_BOM + lines.join(EOL) + EOL;
}

/** `kpi-report-2026-10.csv`, `roi-report-ytd.csv`: the period is in the name, as the screen has it. */
export const reportFileName = (kind: "kpi" | "roi", period_param: string) => `${kind}-report-${period_param}.csv`;
