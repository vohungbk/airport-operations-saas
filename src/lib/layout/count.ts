/** The largest number written out; a larger one shows as `99+` (spec E2). */
export const MAX_SHOWN_COUNT = 99;

/**
 * The text of a count badge, or `null` when there is nothing to show: a count below 1, or a
 * value that is not a number. A fraction is cut to a whole number.
 */
export function formatCount(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  const whole = Math.floor(count);
  return whole > MAX_SHOWN_COUNT ? `${MAX_SHOWN_COUNT}+` : String(whole);
}
