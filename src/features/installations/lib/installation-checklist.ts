/**
 * The installation checklist of a technician (FO-F07-S05, ME3). Every item is required. The keys are
 * stored with the installation and checked again by the database, so a key is never renamed: add a new
 * one instead.
 */
export const INSTALLATION_CHECKLIST = [
  { key: "category_and_fit", label: "Correct category and child fit verified" },
  {
    key: "shell_and_harness",
    label: "Seat shell and harness free from damage",
  },
  {
    key: "isofix_belt",
    label: "ISOFIX / belt secured to manufacturer guidance",
  },
  { key: "seat_movement", label: "Seat movement checked at belt path" },
  { key: "harness_tension", label: "Harness height and tension verified" },
  { key: "final_safety", label: "Final safety check completed" },
] as const;

export type InstallationChecklistKey =
  (typeof INSTALLATION_CHECKLIST)[number]["key"];

export const INSTALLATION_CHECKLIST_KEYS = INSTALLATION_CHECKLIST.map(
  (item) => item.key,
) as [InstallationChecklistKey, ...InstallationChecklistKey[]];

/** The items of the checklist that are not in `checked`, in the order of the checklist. */
export function getMissingChecklistItems(checked: readonly string[]) {
  return INSTALLATION_CHECKLIST.filter((item) => !checked.includes(item.key));
}

/** Adds `key` to `checked` or takes it out, keeping the order of the checklist. */
export function toggleChecklistKey(
  checked: readonly string[],
  key: InstallationChecklistKey,
): InstallationChecklistKey[] {
  const next = new Set(checked);

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  return INSTALLATION_CHECKLIST_KEYS.filter((item) => next.has(item));
}

/** The line under "Continue to photos"; `null` once every item is checked. */
export function getChecklistHint(remaining: number): string | null {
  if (remaining <= 0) return null;
  if (remaining === 1) return "Complete the final check to continue.";
  if (remaining === 2) return "Complete the final two checks to continue.";

  return `Complete the remaining ${remaining} checks to continue.`;
}

/** The error shown when the checklist is sent with items left unchecked; it names what is missing. */
export function getChecklistIncompleteMessage(
  checked: readonly string[],
): string {
  const labels = getMissingChecklistItems(checked).map((item) => item.label);

  return `Complete every checklist item. Missing: ${labels.join("; ")}.`;
}
