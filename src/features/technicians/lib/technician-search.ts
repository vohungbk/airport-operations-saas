/**
 * Search-field rule (spec V1), kept free of schema libraries so the
 * client filter form can use it without pulling Zod into the browser
 * bundle. The server query schema reads the same constants.
 */
export const TECHNICIAN_SEARCH_MAX_LENGTH = 100;

export const TECHNICIAN_SEARCH_TOO_LONG_MESSAGE = `Search must be ${TECHNICIAN_SEARCH_MAX_LENGTH} characters or fewer.`;

/** Returns an error message for an invalid search value, or `null`. */
export function getTechnicianSearchError(value: string): string | null {
  return value.trim().length > TECHNICIAN_SEARCH_MAX_LENGTH
    ? TECHNICIAN_SEARCH_TOO_LONG_MESSAGE
    : null;
}
