/** Formats a month-based age range for display, e.g. "0-12 months". */
export function formatAgeRange(min: number, max: number): string {
  const unit = max === 1 ? "month" : "months";
  return `${min}-${max} ${unit}`;
}
