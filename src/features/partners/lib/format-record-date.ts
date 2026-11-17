const RECORD_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** A record date as the design shows it: `04 Nov 2026, 09:00 ICT`. Indochina Time, the time zone of the operation. */
export function formatRecordDate(value: string): string {
  const parts = Object.fromEntries(
    RECORD_DATE_FORMAT.formatToParts(new Date(value)).map((part) => [
      part.type,
      part.value,
    ]),
  );

  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute} ICT`;
}
