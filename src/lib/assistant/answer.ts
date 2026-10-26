/**
 * Pure logic for the assistant parts (UI-F04-S04, spec R8, E5). Numbers are formatted by the
 * caller (`*_text`), so no value is made up here and no locale changes a result.
 */

export interface AnswerKpi {
  label: string;
  current: number;
  /** The figure of the period before; null when there is none. */
  previous: number | null;
  current_text: string;
  previous_text?: string;
}

export interface AnswerBar {
  label: string;
  value: number;
  value_text: string;
}

export type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "table"; columns: readonly string[]; rows: readonly (readonly string[])[] }
  | { type: "chart"; title: string; bars: readonly AnswerBar[] }
  | { type: "kpi"; items: readonly AnswerKpi[] }
  | { type: "recommendations"; items: readonly string[] };

export type ChangeDirection = "up" | "down" | "flat" | "unknown";

export interface KpiChange {
  direction: ChangeDirection;
  /** `+12.5%`, `-8.0%`, `0%`, or `n/a` when there is nothing to compare with. */
  text: string;
}

/** The change against the period before. A zero or missing base gives n/a, never Infinity or NaN. */
export function formatChange(current: number, previous: number | null): KpiChange {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(current) || previous === 0) {
    return { direction: "unknown", text: "n/a" };
  }
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return { direction: "flat", text: "0%" };
  return { direction: rounded > 0 ? "up" : "down", text: `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%` };
}

/** The width of a bar, 0 to 100. A bar of a missing or negative value, or with no maximum, is empty. */
export function barPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export function blockHasData(block: AnswerBlock): boolean {
  switch (block.type) {
    case "text":
      return block.text.trim().length > 0;
    case "table":
      return block.rows.length > 0;
    case "chart":
      return block.bars.length > 0;
    case "kpi":
      return block.items.length > 0;
    case "recommendations":
      return block.items.length > 0;
  }
}

/** False when every block is empty, so the card says there is no data instead of drawing zeros. */
export function hasAnswerData(blocks: readonly AnswerBlock[]): boolean {
  return blocks.some(blockHasData);
}
