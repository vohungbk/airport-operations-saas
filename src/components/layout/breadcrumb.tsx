"use client";

import { ChevronRight, House } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DASHBOARD_ROUTE } from "@/lib/constants/routes";
import { buildBreadcrumb } from "@/lib/layout/breadcrumb";

interface BreadcrumbProps {
  /** The menu of the role: it names the area. */
  items: Array<{ href: string; label: string }>;
}

/**
 * UI-F02-S02 (spec R3): where the user is, from the path. A home link first, then the area and
 * the steps below it; the last crumb is the current page. A long crumb is cut and keeps its text
 * as the title. The home link goes to the dashboard route, which every role shares and which
 * sends a partner user on to the partner portal.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  const crumbs = buildBreadcrumb(usePathname(), items);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="shrink-0">
          <Link
            href={DASHBOARD_ROUTE}
            aria-label="Home"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <House className="size-4" aria-hidden="true" />
          </Link>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {crumb.href ? (
              <Link
                href={crumb.href}
                title={crumb.label}
                className="truncate rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                title={crumb.label}
                aria-current={index === crumbs.length - 1 ? "page" : undefined}
                className="truncate font-medium text-foreground"
              >
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
