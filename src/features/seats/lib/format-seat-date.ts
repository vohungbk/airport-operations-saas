const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** `2026-10-01` -> `1 Oct 2026`: how a picked date reads in the date picker box. */
export function formatSeatDate(date: string): string {
  const [year, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}
