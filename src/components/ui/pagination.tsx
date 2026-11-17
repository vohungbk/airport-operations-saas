import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { buildPageItems } from "@/lib/pagination/pages"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  /** Address of a page; the caller owns the query string. */
  buildHref: (page: number) => string
  /** Previous and Next as words, and every button at least 44 px (the Partners list), instead of arrows. */
  labelled?: boolean
  className?: string
}

/** Links only, no client JS. The current page is `aria-current="page"`; an end that cannot be followed is disabled. */
function Pagination({ page, totalPages, buildHref, labelled = false, className }: PaginationProps) {
  const last = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, page), last)
  const items = buildPageItems(current, last)

  const stepClass = labelled
    ? cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4")
    : buttonVariants({ variant: "outline", size: "icon-sm" })
  const numberClass = (isCurrent: boolean) =>
    cn(
      buttonVariants({ variant: isCurrent ? "default" : "ghost", size: "icon-sm" }),
      labelled && "size-11"
    )

  const step = (label: string, text: string, target: number, enabled: boolean, icon: React.ReactNode) =>
    enabled ? (
      <Link href={buildHref(target)} aria-label={label} className={stepClass}>
        {labelled ? text : icon}
      </Link>
    ) : (
      <span
        aria-label={label}
        aria-disabled="true"
        className={cn(stepClass, "pointer-events-none opacity-50", labelled && "bg-muted")}
      >
        {labelled ? text : icon}
      </span>
    )

  return (
    <nav aria-label="Pagination" data-slot="pagination" className={cn("flex min-w-0 justify-center", className)}>
      <ul className="flex min-w-0 flex-wrap items-center justify-center gap-1">
        <li>{step("Previous page", "Previous", current - 1, current > 1, <ChevronLeftIcon />)}</li>
        {items.map((item) =>
          typeof item === "number" ? (
            <li key={item}>
              <Link
                href={buildHref(item)}
                aria-current={item === current ? "page" : undefined}
                className={numberClass(item === current)}
              >
                {item}
              </Link>
            </li>
          ) : (
            <li key={item} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </li>
          )
        )}
        <li>{step("Next page", "Next", current + 1, current < last, <ChevronRightIcon />)}</li>
      </ul>
    </nav>
  )
}

export { Pagination }
export type { PaginationProps }
