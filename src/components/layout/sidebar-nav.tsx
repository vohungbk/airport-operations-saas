"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/config/nav";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavProps {
  items: Array<{ href: string; label: string }>;
  /** Icons only, with a tooltip for each (the 72 px desktop sidebar). */
  collapsed?: boolean;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Presentation only — active-link styling via `usePathname()`. The
 * permission filtering already happened server-side in `AppShell`; this
 * component never decides which items to show. Icons are resolved from
 * the statically-imported `NAV_ITEMS` rather than passed in via props,
 * since a Lucide icon component can't cross the Server->Client boundary
 * as serialized prop data.
 *
 * The current item has a marker on its left edge, the active color and
 * `aria-current="page"`. A long label is cut and keeps its full text as the
 * title. Collapsed, only the icon shows; the label stays for screen readers
 * and appears as a tooltip on hover and on keyboard focus.
 */
export function SidebarNav({ items, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = isNavItemActive(pathname, item.href);
        const Icon = NAV_ITEMS.find((navItem) => navItem.href === item.href)!
          .icon;
        const className = cn(
          "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          collapsed && "justify-center px-0",
          isActive &&
            "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary",
        );
        const ariaCurrent = isActive ? ("page" as const) : undefined;

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-current={ariaCurrent}
                    className={className}
                  />
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="sr-only">{item.label}</span>
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ariaCurrent}
            title={item.label}
            className={className}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
