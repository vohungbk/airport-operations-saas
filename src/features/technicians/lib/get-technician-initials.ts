const MAX_INITIALS = 3;

/** Pure — "Nguyen Van An" becomes "NVA"; at most three letters, upper case. */
export function getTechnicianInitials(full_name: string): string {
  return full_name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word)[0].toUpperCase())
    .slice(0, MAX_INITIALS)
    .join("");
}
