/** Pure toast queue logic (UI-F03-S04): add with a limit, dismiss by id. */

export type ToastKind = "info" | "success" | "error"

export interface ToastItem {
  id: string
  kind: ToastKind
  message: string
  /** Milliseconds before it closes on its own; 0 keeps it until the user closes it. */
  duration: number
}

export const MAX_TOASTS = 3
export const DEFAULT_TOAST_DURATION = 5000

/** The newest toast goes last; when the limit is passed the oldest one goes first. */
export function addToast(list: ToastItem[], item: ToastItem, max = MAX_TOASTS): ToastItem[] {
  return [...list.filter((t) => t.id !== item.id), item].slice(-max)
}

export function dismissToast(list: ToastItem[], id: string): ToastItem[] {
  return list.filter((t) => t.id !== id)
}

/** An error is announced at once (`alert`); the rest wait their turn (`status`). */
export function toastRole(kind: ToastKind): "alert" | "status" {
  return kind === "error" ? "alert" : "status"
}
