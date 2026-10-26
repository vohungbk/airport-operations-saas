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
  className?: string
}

/** Links only, no client JS. The current page is `aria-current="page"`; an end that cannot be followed is disabled. */
function Pagination({ page, totalPages, buildHref, className }: PaginationProps) {
  const last = Math.max(1, totalPages)
  const current = Math.min(Math.max(1, page), last)
  const items = buildPageItems(current, last)

  const step = (label: string, target: number, enabled: boolean, icon: React.ReactNode) =>
    enabled ? (
      <Link
        href={buildHref(target)}
        aria-label={label}
        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
      >
        {icon}
      </Link>
    ) : (
      <span
        aria-label={label}
        aria-disabled="true"
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "pointer-events-none opacity-50")}
      >
        {icon}
      </span>
    )

  return (
    <nav aria-label="Pagination" data-slot="pagination" className={cn("flex min-w-0 justify-center", className)}>
      <ul className="flex min-w-0 flex-wrap items-center justify-center gap-1">
        <li>{step("Previous page", current - 1, current > 1, <ChevronLeftIcon />)}</li>
        {items.map((item) =>
          typeof item === "number" ? (
            <li key={item}>
              <Link
                href={buildHref(item)}
                aria-current={item === current ? "page" : undefined}
                className={buttonVariants({ variant: item === current ? "default" : "ghost", size: "icon-sm" })}
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
        <li>{step("Next page", current + 1, current < last, <ChevronRightIcon />)}</li>
      </ul>
    </nav>
  )
}

export { Pagination }
export type { PaginationProps }
