"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/config/nav";
import { CountBadge } from "@/components/layout/count-badge";
import { useIsTruncated } from "@/components/layout/use-is-truncated";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavItem {
  href: string;
  label: string;
  /** A number to show next to the label, for example how many things wait. Nothing sets it yet. */
  count?: number;
}

interface SidebarNavProps {
  items: SidebarNavItem[];
  /** Icons only, with a tooltip for each (the 72 px desktop sidebar). */
  collapsed?: boolean;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarNavLinkProps {
  item: SidebarNavItem;
  Icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
}

/**
 * One item of the menu. The tooltip with the full label shows when the sidebar is collapsed, and
 * when it is expanded and the label is too long to fit and is cut.
 */
function SidebarNavLink({ item, Icon, isActive, collapsed }: SidebarNavLinkProps) {
  const { ref, truncated } = useIsTruncated<HTMLSpanElement>();

  return (
    <Tooltip disabled={!collapsed && !truncated}>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              collapsed && "justify-center px-0",
              isActive &&
                "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary before:absolute before:top-1/2 before:left-0 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-primary",
            )}
          />
        }
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span ref={ref} className={cn("truncate", collapsed && "sr-only")}>
          {item.label}
        </span>
        {!collapsed && item.count !== undefined && <CountBadge count={item.count} />}
      </TooltipTrigger>
      <TooltipContent>{item.label}</TooltipContent>
    </Tooltip>
  );
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
 * `aria-current="page"`. A long label is cut and shows in full in a tooltip. Collapsed,
 * only the icon shows; the label stays for screen readers and appears as a tooltip on
 * hover and on keyboard focus. A count, when an item has one, shows as `99+` from 100 up.
 */
export function SidebarNav({ items, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {items.map((item) => (
        <SidebarNavLink
          key={item.href}
          item={item}
          Icon={NAV_ITEMS.find((navItem) => navItem.href === item.href)!.icon}
          isActive={isNavItemActive(pathname, item.href)}
          collapsed={collapsed}
        />
      ))}
    </nav>
  );
}
