import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { getVisibleNavItems } from "@/config/nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/top-bar";
import { ThemeControl } from "@/components/theme/theme-control";
import type { AppUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import {
  SIDEBAR_COOKIE,
  parseSidebarCollapsed,
} from "@/lib/layout/sidebar-preference";

interface AppShellProps {
  user: AppUser;
  children: ReactNode;
}

/**
 * Server Component shell shared by every protected route group. Computes
 * the visible nav items for `user.role` server-side and hands the
 * already-filtered list to the client-only `DesktopSidebar` (from `md` up)
 * and `MobileNav` (below `md`) — the permission check itself never runs in
 * the browser. It also reads the saved sidebar width from a cookie so the
 * first paint is already at the right size. From `md` up the content sits under
 * the top bar (UI-F02-S02); below it, under the app bar.
 */
export async function AppShell({ user, children }: AppShellProps) {
  const navItems = getVisibleNavItems(user.role).map(({ href, label }) => ({
    href,
    label,
  }));
  const initialCollapsed = parseSidebarCollapsed(
    (await cookies()).get(SIDEBAR_COOKIE)?.value,
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <header className="flex items-center gap-3 border-b border-border bg-background p-3 md:hidden print:hidden">
        <MobileNav
          user={{ full_name: user.full_name, email: user.email }}
          items={navItems}
        />
        <span className="text-sm font-medium text-foreground">
          Airport Operations
        </span>
        <div className="ml-auto">
          <ThemeControl />
        </div>
      </header>
      <DesktopSidebar items={navItems} initialCollapsed={initialCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          items={navItems}
          user={{
            full_name: user.full_name,
            email: user.email,
            role_label: ROLE_LABELS[user.role],
          }}
        />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
