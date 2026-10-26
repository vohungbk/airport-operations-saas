"use client"

import * as React from "react"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  addToast,
  DEFAULT_TOAST_DURATION,
  dismissToast,
  toastRole,
  type ToastItem,
  type ToastKind,
} from "@/lib/toast/queue"
import { cn } from "@/lib/utils"

let toasts: ToastItem[] = []
let counter = 0
const listeners = new Set<() => void>()

const emit = (next: ToastItem[]) => {
  toasts = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Shows a message. Plain text only: it is never rendered as HTML. */
function toast(message: string, kind: ToastKind = "info", duration = DEFAULT_TOAST_DURATION): string {
  const id = `toast-${++counter}`
  emit(addToast(toasts, { id, kind, message, duration }))
  return id
}

const ICON = { info: InfoIcon, success: CircleCheckIcon, error: CircleAlertIcon } as const
const TONE = {
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
  error: "bg-danger-bg text-danger-fg",
} as const

function ToastCard({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  React.useEffect(() => {
    if (item.duration <= 0) return
    const timer = setTimeout(() => onClose(item.id), item.duration)
    return () => clearTimeout(timer)
  }, [item.id, item.duration, onClose])

  const Icon = ICON[item.kind]

  return (
    <div
      role={toastRole(item.kind)}
      data-slot="toast"
      data-kind={item.kind}
      className={cn("flex w-full min-w-0 items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10", TONE[item.kind])}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words">{item.message}</p>
      <Button type="button" variant="ghost" size="icon-xs" onClick={() => onClose(item.id)}>
        <XIcon />
        <span className="sr-only">Close</span>
      </Button>
    </div>
  )
}

/** Mount once near the root of a layout. */
function Toaster() {
  const items = React.useSyncExternalStore(subscribe, () => toasts, () => toasts)
  const close = React.useCallback((id: string) => emit(dismissToast(toasts, id)), [])

  return (
    <div
      data-slot="toaster"
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full">
          <ToastCard item={item} onClose={close} />
        </div>
      ))}
    </div>
  )
}

export { Toaster, toast }
