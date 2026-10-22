import type { AgreedTarget, RejectedTarget } from "@/lib/performance/targets";

/**
 * VI-F08-S06 (spec R6, E2): the numbers of a measurement, and the report. Pure:
 * the run that takes the times is src/lib/performance/measure.perf.ts.
 */

export interface Workflow {
  id: string;
  kind: "list" | "detail" | "create";
  label: string;
}

/** The key workflows that are measured. */
export const WORKFLOWS: readonly Workflow[] = [
  { id: "list:bookings", kind: "list", label: "Bookings list (/bookings)" },
  { id: "list:seats", kind: "list", label: "Seats list (/seats)" },
  { id: "list:jobs", kind: "list", label: "Jobs list (/jobs)" },
  { id: "list:incidents", kind: "list", label: "Incidents list (/incidents)" },
  { id: "detail:booking", kind: "detail", label: "Booking detail" },
  { id: "detail:seat", kind: "detail", label: "Seat detail" },
  { id: "detail:job", kind: "detail", label: "Job detail" },
  { id: "detail:incident", kind: "detail", label: "Incident detail" },
  { id: "create:booking-form", kind: "create", label: "Add booking page (/bookings/new)" },
  { id: "create:booking", kind: "create", label: "Create a booking (create_booking)" },
];

export interface Stats {
  runs: number;
  min: number;
  median: number;
  p95: number;
  max: number;
}

/** Nearest-rank percentile of a sorted list: the smallest value with `p` of the runs at or below it. */
function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(p * sorted.length))) - 1];
}

/** Pure. The figures of a list of times in milliseconds. */
export function summarize(times: readonly number[]): Stats {
  if (times.length === 0) {
    throw new Error("cannot summarize no runs");
  }
  const sorted = [...times].sort((a, b) => a - b);

  return {
    runs: sorted.length,
    min: sorted[0],
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1],
  };
}

export type Verdict =
  | { kind: "measured_only" }
  | { kind: "within_target" | "over_target"; target: AgreedTarget };

/**
 * Pure. A workflow has a verdict only when a complete target was agreed for it;
 * otherwise it is measured and reported, and nothing is claimed about it.
 */
export function evaluate(workflowId: string, stats: Stats, targets: readonly AgreedTarget[]): Verdict {
  const target = targets.find((t) => t.workflow === workflowId);
  if (!target) return { kind: "measured_only" };

  return { kind: stats.p95 <= target.limit_ms ? "within_target" : "over_target", target };
}

export interface Measured {
  workflow: Workflow;
  stats: Stats;
  note?: string;
}

export interface ReportInput {
  measuredAt: string;
  commit: string;
  mode: "production" | "development" | "unknown";
  environment: string;
  measured: readonly Measured[];
  targets: readonly AgreedTarget[];
  rejected: readonly RejectedTarget[];
}

/** Whole milliseconds, and one decimal under 10 so a fast call is not shown as 0 or 5 flat. */
const ms = (value: number) => (value < 10 ? value.toFixed(1) : `${Math.round(value)}`);

/** Pure. The report: numbers, and a verdict only where a target was agreed. */
export function buildReport(input: ReportInput): string {
  const known = new Set(WORKFLOWS.map((w) => w.id));
  const lines: string[] = [
    "# Performance measurements",
    "",
    `- Measured at: ${input.measuredAt}`,
    `- Commit: ${input.commit}`,
    `- Server mode: ${input.mode}`,
    `- Machine: ${input.environment}`,
    `- Times are in milliseconds, for one user, one request after another.`,
    "",
  ];

  if (input.targets.length === 0) {
    lines.push(
      "**No performance target is agreed (spec Q2).** These are measurements. They are not a claim that any workflow is fast enough, and nothing below is compared with a number.",
      "",
    );
  } else {
    lines.push(
      "Where a target was agreed it is shown with who agreed it. A workflow with no agreed target is measured only.",
      "",
    );
  }
  const few = input.measured.filter(({ stats }) => stats.runs < 20);
  if (few.length > 0) {
    lines.push(
      `With fewer than 20 runs the 95th percentile is the slowest run, so p95 and Max are the same figure: ${few.map(({ workflow }) => workflow.label).join("; ")}.`,
      "",
    );
  }
  if (input.mode === "development") {
    lines.push(
      "The server runs in development mode: pages are compiled when first used and run slower than in production, so these numbers are not representative.",
      "",
    );
  }

  lines.push("| Workflow | Runs | Min | Median | p95 | Max | Target |", "|---|---|---|---|---|---|---|");
  for (const { workflow, stats, note } of input.measured) {
    const verdict = evaluate(workflow.id, stats, input.targets);
    const target =
      verdict.kind === "measured_only"
        ? "none agreed"
        : `p95 at most ${verdict.target.limit_ms} ms: ${verdict.kind === "within_target" ? "within" : "over"} (agreed by ${verdict.target.agreed_by} on ${verdict.target.agreed_on}; ${verdict.target.load})`;
    lines.push(
      `| ${workflow.label}${note ? ` (${note})` : ""} | ${stats.runs} | ${ms(stats.min)} | ${ms(stats.median)} | ${ms(stats.p95)} | ${ms(stats.max)} | ${target} |`,
    );
  }

  const stale = input.targets.filter((t) => !known.has(t.workflow));
  if (stale.length > 0 || input.rejected.length > 0) {
    lines.push("", "## Targets that were not used", "");
    for (const target of stale) {
      lines.push(`- ${target.workflow}: there is no such workflow, so the target is not used.`);
    }
    for (const { index, issues } of input.rejected) {
      lines.push(`- Target ${index + 1} is not complete, so it is not a target: ${issues.join("; ")}.`);
    }
  }

  return `${lines.join("\n")}\n`;
}
