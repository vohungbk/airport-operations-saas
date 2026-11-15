import { BOOKING_IMPORT_TEMPLATE_COLUMNS } from "@/features/bookings/lib/booking-import-template";
import { isCsvFile } from "@/features/bookings/lib/csv-file";

/**
 * CO-F07-S02 (spec V1, Q2): the size limit of an import file. The spec has not fixed it yet (Q2);
 * this is the one place that holds it. `serverActions.bodySizeLimit` in `next.config.ts` stays above it.
 */
export const BOOKING_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** CO-F07-S03 (Q2): the most rows one import may hold. Open in the spec, kept in this one place. */
export const BOOKING_IMPORT_MAX_ROWS = 1000;

export type ImportFileErrorCode =
  | "PARTNER_REQUIRED"
  | "AIRPORT_UNAVAILABLE"
  | "NO_ROWS"
  | "TOO_MANY_ROWS"
  | "NOTHING_TO_IMPORT"
  | "IMPORT_FAILED"
  | "FILE_REQUIRED"
  | "NOT_A_CSV"
  | "FILE_TOO_LARGE"
  | "WRONG_HEADER"
  | "UNSUPPORTED_ENCODING"
  | "FORBIDDEN"
  | "NETWORK_ERROR";

interface ImportFileErrorCopy {
  title: string;
  message: string;
  /** The text of "Before you try again". */
  tips: string;
}

/** What the user is told for each refusal (design frames File too large, Wrong CSV header, Unsupported encoding). */
export const IMPORT_FILE_ERRORS: Record<ImportFileErrorCode, ImportFileErrorCopy> = {
  PARTNER_REQUIRED: {
    title: "Select a partner",
    message: "Choose the partner the bookings belong to.",
    tips: "",
  },
  AIRPORT_UNAVAILABLE: {
    title: "Airport not set",
    message: "The import needs exactly one airport, and this account does not see exactly one.",
    tips: "Contact your administrator to set the airport for booking imports.",
  },
  NO_ROWS: {
    title: "No booking rows",
    message: "The file has a header but no booking rows. Add your bookings under the header and upload it again.",
    tips: "Download the template and copy your booking data into it, one booking on each line.",
  },
  TOO_MANY_ROWS: {
    title: "Too many rows",
    message: `This file has more than ${BOOKING_IMPORT_MAX_ROWS} rows. Split it into smaller files and upload them again.`,
    tips: `Keep the template header in each file. The maximum number of rows is to be confirmed.`,
  },
  NOTHING_TO_IMPORT: {
    title: "No valid rows",
    message: "None of the rows passed validation, so no bookings can be created from this file.",
    tips: "Fix the rows in the report and upload the file again.",
  },
  IMPORT_FAILED: {
    title: "Import failed",
    message: "The import could not be completed. No bookings were created. Try again.",
    tips: "Check your connection and try the import again. Your file is kept on this screen.",
  },
  FILE_REQUIRED: {
    title: "Choose a CSV file",
    message: "No file was received. Choose a CSV file and upload it again.",
    tips: "Use the template to prepare your file, then save it as CSV.",
  },
  NOT_A_CSV: {
    title: "Not a CSV file",
    message: "Only CSV files can be imported. Save the file as CSV and upload it again.",
    tips: "Download the template and copy your booking data into it. Save the result as CSV.",
  },
  FILE_TOO_LARGE: {
    title: "File too large",
    message: "This file could not be accepted. Reduce the file size and upload it again.",
    tips: "Split the bookings into smaller CSV files, keeping the template header in each file. The maximum supported size is to be confirmed.",
  },
  WRONG_HEADER: {
    title: "Wrong CSV header",
    message: "The column headers do not match the booking import template. No rows have been validated.",
    tips: "Download the template and copy your booking data into it. Keep the column names and their order unchanged, then upload the corrected CSV.",
  },
  UNSUPPORTED_ENCODING: {
    title: "Unsupported encoding",
    message: "We couldn't read this file's text encoding. Save the CSV with UTF-8 encoding and upload it again.",
    tips: "In your spreadsheet app, use Save as or Export and choose CSV UTF-8. Keep the template header unchanged so booking numbers and other text can be read correctly.",
  },
  FORBIDDEN: {
    title: "You do not have permission to import bookings",
    message: "Your access to booking imports has changed. Nothing was imported.",
    tips: "Contact your administrator to request booking import access.",
  },
  NETWORK_ERROR: {
    title: "Connection problem",
    message: "The request did not reach the server. Nothing was saved.",
    tips: "Check your connection and try again. Your file and partner are kept on this screen.",
  },
};

/**
 * V1, E1: what is known of a file before a byte of it is read: it is a CSV by its name and it is
 * within the limit. The same check runs in the browser and on the server.
 */
export function checkImportFileMeta(file: { name: string; size: number }): ImportFileErrorCode | null {
  if (!isCsvFile(file)) return "NOT_A_CSV";
  if (file.size > BOOKING_IMPORT_MAX_FILE_BYTES) return "FILE_TOO_LARGE";
  return null;
}

/** E3: the text of the file as UTF-8 (a leading byte order mark is dropped), or `null` for any other encoding. */
export function decodeCsvText(bytes: ArrayBuffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * E2: the first line of the file must be the template header, the same columns in the same order.
 * Only that line is read; no row of data is looked at.
 */
export function checkImportHeader(text: string): ImportFileErrorCode | null {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const columns = firstLine.split(",").map((column) => column.trim());
  const matches =
    columns.length === BOOKING_IMPORT_TEMPLATE_COLUMNS.length &&
    BOOKING_IMPORT_TEMPLATE_COLUMNS.every((column, index) => columns[index] === column);

  return matches ? null : "WRONG_HEADER";
}
