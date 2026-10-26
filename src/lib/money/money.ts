/**
 * Pure money logic for the money parts (UI-F04-S02, spec R10, R11, E2). Amounts are summed in whole
 * cents, so 0.1 + 0.2 is 0.30. The currency is still open (spec Q1): no symbol is written, only two
 * decimals like `formatMoney` of the booking screens. An estimate has its own type and cannot be
 * given to `sumVerified`.
 */

export type AdjustmentKind = "refund" | "chargeback";

export const ADJUSTMENT_LABEL: Record<AdjustmentKind, string> = {
  refund: "Refund",
  chargeback: "Chargeback",
};

export const toCents = (value: number): number => Math.round(value * 100);

export interface FormattedAmount {
  text: string;
  negative: boolean;
}

/** `-12.50`, `12.50`, `0.00`. An amount that rounds to zero has no sign, so there is no "-0.00". */
export function formatAmount(value: number): FormattedAmount {
  const cents = toCents(value);
  if (!Number.isFinite(cents) || cents === 0) return { text: "0.00", negative: false };
  const abs = Math.abs(cents);
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? { text: `-${text}`, negative: true } : { text, negative: false };
}

export interface VerifiedLine {
  label: string;
  amount: number;
  kind?: AdjustmentKind;
}

/** An estimated number. It has no `amount` a total could read by mistake. */
export interface EstimatedLine {
  label: string;
  estimate: number;
}

/** The total of verified lines only; there is no way to pass an estimate. */
export function sumVerified(lines: readonly VerifiedLine[]): number {
  return lines.reduce((sum, line) => sum + toCents(line.amount), 0) / 100;
}

export interface MeterProgress {
  /** 0 to 100, for the bar; null when there is no target to measure against. */
  percent: number | null;
  /** The true share, which can pass 100. */
  share: number | null;
}

export function meterProgress(accumulated: number, target: number | null): MeterProgress {
  if (target === null || !Number.isFinite(target) || target <= 0) return { percent: null, share: null };
  const share = Math.round((accumulated / target) * 100);
  return { percent: Math.min(100, Math.max(0, share)), share };
}
