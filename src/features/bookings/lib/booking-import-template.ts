/**
 * CO-F07-S01 (spec R3, R7): the CSV template of the booking import. It holds only the header row,
 * so the user types the bookings under it. The columns follow the booking fields the import maps
 * (R7); the exact list is still open in the spec (Q3), so it is kept in this one place.
 */
export const BOOKING_IMPORT_TEMPLATE_COLUMNS = [
  "external_booking_number",
  "pickup_time",
  "return_time",
  "flight_number",
  "seat_category",
  "child_age_band",
  "vehicle",
  "notes",
  "rate",
] as const;

export const BOOKING_IMPORT_TEMPLATE_FILE_NAME = "booking-import-template.csv";

/** The address the "Download template" link points to. */
export const BOOKING_IMPORT_TEMPLATE_HREF = "/api/bookings/import-template";

export function buildBookingImportTemplateCsv(): string {
  return `${BOOKING_IMPORT_TEMPLATE_COLUMNS.join(",")}\r\n`;
}
