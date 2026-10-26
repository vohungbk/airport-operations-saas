/** Pure logic for the checklist part (UI-F04-S03, spec R6): which required items are still open. */

export interface ChecklistEntry {
  required: boolean;
  checked: boolean;
}

export function remainingRequired(items: readonly ChecklistEntry[]): number {
  return items.filter((item) => item.required && !item.checked).length;
}

/** A list with no required item is complete; an empty list too. */
export function isChecklistComplete(items: readonly ChecklistEntry[]): boolean {
  return remainingRequired(items) === 0;
}
