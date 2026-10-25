"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useSidebarCollapsed } from "@/components/layout/use-sidebar-collapsed";
import { ThemeControl } from "@/components/theme/theme-control";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/layout/sidebar-preference";
import { cn } from "@/lib/utils";

interface DesktopSidebarProps {
  user: { full_name: string; email: string };
  items: Array<{ href: string; label: string }>;
  /** What the server read from the cookie, so the first paint is at the right width. */
  initialCollapsed: boolean;
}

/**
 * UI-F02-S01 (spec R1, R2, R10): the sidebar of the wide screens (768 px and up). Expanded it is
 * 256 px with the labels; collapsed it is 72 px with icons and tooltips. The choice is kept in a
 * cookie. It gets the items already filtered by role from `AppShell`.
 */
export function DesktopSidebar({ user, items, initialCollapsed }: DesktopSidebarProps) {
  const { collapsed, toggle } = useSidebarCollapsed(initialCollapsed);
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <TooltipProvider>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden shrink-0 flex-col justify-between border-r border-border bg-background p-4 transition-[width] duration-200 motion-reduce:transition-none md:flex print:hidden",
          collapsed ? SIDEBAR_WIDTH_CLASS.collapsed : SIDEBAR_WIDTH_CLASS.expanded,
          collapsed && "items-center px-3",
        )}
      >
        <div className="flex w-full flex-col gap-6">
          <div
            className={cn(
              "flex items-center gap-2",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {!collapsed && (
              <span className="truncate text-sm font-semibold text-foreground">
                Airport Operations
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={label}
              aria-expanded={!collapsed}
              title={label}
              onClick={toggle}
            >
              <Toggle aria-hidden="true" />
            </Button>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user.full_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          )}
          <SidebarNav items={items} collapsed={collapsed} />
        </div>
        <div
          className={cn(
            "flex gap-2",
            collapsed ? "flex-col items-center" : "items-center justify-between",
          )}
        >
          <LogoutButton iconOnly={collapsed} />
          <ThemeControl />
        </div>
      </aside>
    </TooltipProvider>
  );
}
