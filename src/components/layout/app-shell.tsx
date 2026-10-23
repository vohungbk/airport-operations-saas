import type { ReactNode } from "react";

import { getVisibleNavItems } from "@/config/nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LogoutButton } from "@/features/auth/components/logout-button";
import type { AppUser } from "@/lib/auth/current-user";

interface AppShellProps {
  user: AppUser;
  children: ReactNode;
}

/**
 * Server Component shell shared by every protected route group. Computes
 * the visible nav items for `user.role` server-side and hands the
 * already-filtered list to the client-only `SidebarNav` (desktop) and
 * `MobileNav` (below `md`) — the permission check itself never runs in
 * the browser.
 */
export function AppShell({ user, children }: AppShellProps) {
  const navItems = getVisibleNavItems(user.role).map(({ href, label }) => ({
    href,
    label,
  }));

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
      </header>
      <aside className="hidden w-64 shrink-0 flex-col justify-between md:flex border-r border-border bg-background p-4 print:hidden">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium text-foreground">
              {user.full_name}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <SidebarNav items={navItems} />
        </div>
        <LogoutButton />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
