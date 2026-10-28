import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartCardRow {
  label: string;
  value: number;
  /** Which of the six chart colors; the position of the row when not given. */
  color?: number;
  /** The symbol before the label; the one of the position when not given, none when empty. */
  symbol?: string;
}

/** The six chart colors of the design, in its order (solid; the symbol in the label tells the series apart). */
const FILL = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
] as const;
/**
 * The same colors with the text that is written on them (the count in a segment), each pair with a contrast of
 * 4.5:1 or more in Light and in Dark: white on the dark Light colors, dark on the orange and the green.
 */
const SEGMENT = [
  "bg-chart-1 text-primary-foreground",
  "bg-chart-2 text-primary-foreground",
  "bg-chart-3 text-foreground dark:text-primary-foreground",
  "bg-chart-4 text-foreground dark:text-primary-foreground",
  "bg-chart-5 text-primary-foreground",
  "bg-chart-6 text-primary-foreground",
] as const;
const STROKE = [
  "stroke-chart-1",
  "stroke-chart-2",
  "stroke-chart-3",
  "stroke-chart-4",
  "stroke-chart-5",
  "stroke-chart-6",
] as const;
const SYMBOLS = ["●", "◆", "▲", "■", "✚", "○"] as const;

const at = <T,>(list: readonly T[], index: number): T =>
  list[index % list.length];
const fillOf = (row: ChartCardRow, index: number) =>
  at(FILL, row.color ?? index);
const segmentOf = (row: ChartCardRow, index: number) =>
  at(SEGMENT, row.color ?? index);
const strokeOf = (row: ChartCardRow, index: number) =>
  at(STROKE, row.color ?? index);
const labelOf = (row: ChartCardRow, index: number) =>
  `${row.symbol ?? at(SYMBOLS, index)} ${row.label}`.trim();

function CardTitle({ children }: { children: string }) {
  return (
    <h3 className="text-base font-semibold tracking-tight text-foreground">
      {children}
    </h3>
  );
}

interface BarsCardProps {
  title: string;
  rows: readonly ChartCardRow[];
  /** Said under the bars, with the date (the legend line of the design). */
  legend?: string;
}

/** A bar for each row: the symbol and the label, the count at the end, and a solid bar on a track. */
export function BarsCard({ title, rows, legend }: BarsCardProps) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <CardTitle>{title}</CardTitle>
        <ul className="flex flex-col gap-3.5">
          {rows.map((row, index) => (
            <li key={row.label} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex gap-2 text-sm text-foreground">
                <span className="min-w-0 flex-1 break-words">
                  {labelOf(row, index)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {row.value}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 w-full overflow-hidden rounded-sm bg-muted"
              >
                <div
                  className={cn("h-full rounded-sm", fillOf(row, index))}
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {legend && <p className="text-xs text-muted-foreground">{legend}</p>}
      </CardContent>
    </Card>
  );
}

interface DonutCardProps {
  title: string;
  rows: readonly ChartCardRow[];
  /** The word under the total in the ring. */
  unit: string;
}

const RADIUS = 76;
const THICKNESS = 20;
const GAP = 3;

/** A ring of solid segments with the total in the middle, and a legend of the symbol, the label and the value. */
export function DonutCard({ title, rows, unit }: DonutCardProps) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const circumference = 2 * Math.PI * RADIUS;
  // Where each segment starts: the sum of the lengths before it (no value is changed while drawing).
  const segments = rows.reduce<
    { row: ChartCardRow; index: number; start: number; length: number }[]
  >((all, row, index) => {
    const previous = all[all.length - 1];
    const start = previous ? previous.start + previous.length : 0;
    return [
      ...all,
      {
        row,
        index,
        start,
        length: total > 0 ? (row.value / total) * circumference : 0,
      },
    ];
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <CardTitle>{title}</CardTitle>
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative size-44 shrink-0">
            <svg
              viewBox="0 0 176 176"
              aria-hidden="true"
              className="size-full -rotate-90"
            >
              <circle
                cx="88"
                cy="88"
                r={RADIUS}
                fill="none"
                strokeWidth={THICKNESS}
                className="stroke-muted"
              />
              {segments.map(({ row, index, start, length }) => {
                if (row.value <= 0) return null;
                const dash = Math.max(length - GAP, 0.5);

                return (
                  <circle
                    key={row.label}
                    cx="88"
                    cy="88"
                    r={RADIUS}
                    fill="none"
                    strokeWidth={THICKNESS}
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-start}
                    className={strokeOf(row, index)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight text-foreground">
                {total}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          </div>
          <ul className="flex min-w-40 flex-1 flex-col gap-3 text-sm">
            {rows.map((row, index) => (
              <li key={row.label} className="flex min-w-0 gap-3">
                <span className="min-w-0 flex-1 break-words text-muted-foreground">
                  {labelOf(row, index)}
                </span>
                <span className="shrink-0 text-right text-foreground tabular-nums">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

interface SegmentsCardProps {
  title: string;
  rows: readonly ChartCardRow[];
  /** What the bar counts, for the line under the legend (for example `open incidents`). */
  noun: string;
}

/** One bar cut into the rows that have a count, each with its count inside; the legend and the total under it. */
export function SegmentsCard({ title, rows, noun }: SegmentsCardProps) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <CardTitle>{title}</CardTitle>
        <div className="flex h-8 gap-[3px]">
          {rows.map((row, index) =>
            row.value > 0 ? (
              <div
                key={row.label}
                style={{ flexGrow: row.value }}
                className={cn(
                  "flex min-w-0 basis-0 items-center justify-center text-sm font-semibold",
                  segmentOf(row, index),
                )}
              >
                {row.value}
              </div>
            ) : null,
          )}
        </div>
        <p className="text-sm text-foreground">
          {rows
            .map((row, index) => `${labelOf(row, index)} ${row.value}`)
            .join(" · ")}
        </p>
        <p className="text-sm text-muted-foreground">
          {total} {noun}
        </p>
      </CardContent>
    </Card>
  );
}
