import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DASHBOARD_METRICS,
  getMetricHref,
} from "@/features/dashboard/lib/dashboard-metrics";

interface DocRow {
  label: string;
  table: string;
  rule: Record<string, string>;
  href: string;
}

const SECURITY_DOC = join(process.cwd(), "docs", "security.md");

/** The rows of the formulas table under "What a figure is" in docs/security.md. */
function readFormulaRows(): DocRow[] {
  const lines = readFileSync(SECURITY_DOC, "utf8").split("\n");
  const start = lines.findIndex((line) =>
    line.trim().startsWith("| Figure | Table | Rule (column = value) | Drills into |"),
  );
  if (start === -1) {
    throw new Error("formulas table not found in docs/security.md");
  }

  const rows: DocRow[] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;
    const [label, table, rule, href] = line
      .trim()
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    rows.push({
      label,
      table: table.replaceAll("`", ""),
      rule: Object.fromEntries(
        [...rule.matchAll(/`(\w+) = (\w+)`/g)].map((m) => [m[1], m[2]]),
      ),
      href: href.replaceAll("`", ""),
    });
  }
  return rows;
}

describe("documented dashboard formulas (VI-F01-S05, spec R6)", () => {
  const rows = readFormulaRows();

  it("should document exactly the metrics the dashboard counts, in the same order", () => {
    expect(rows.map((row) => row.label)).toEqual(
      DASHBOARD_METRICS.map((metric) => metric.label),
    );
  });

  it.each(DASHBOARD_METRICS)(
    "should document $id with the table, rule and link the code uses",
    (metric) => {
      const row = rows.find((r) => r.label === metric.label);

      expect(row, `no row for ${metric.label}`).toBeDefined();
      expect(row!.table).toBe(metric.source);
      expect(row!.rule).toEqual(metric.filters);
      expect(row!.href).toBe(getMetricHref(metric));
    },
  );
});
