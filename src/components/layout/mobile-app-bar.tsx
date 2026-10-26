"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildBreadcrumb } from "@/lib/layout/breadcrumb";
import { buildMobileAppBar } from "@/lib/layout/mobile-title";

interface MobileAppBarProps {
  /** The menu of the role: it names the area. */
  items: Array<{ href: string; label: string }>;
}

/**
 * UI-F02-S03 (spec R7): the app bar of a phone, below 768 px. It shows the title of the page and,
 * on a page below an area (a detail, a new or an edit page), an arrow back to the page above.
 * It is not a heading: the page has its own.
 */
export function MobileAppBar({ items }: MobileAppBarProps) {
  const { title, backHref } = buildMobileAppBar(buildBreadcrumb(usePathname(), items));

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:hidden print:hidden">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Back"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      )}
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</p>
    </header>
  );
}
