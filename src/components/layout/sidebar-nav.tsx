"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/config/nav";

interface SidebarNavProps {
  items: Array<{ href: string; label: string }>;
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
 */
export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = isNavItemActive(pathname, item.href);
        const Icon = NAV_ITEMS.find((navItem) => navItem.href === item.href)!
          .icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
