import type { ReactNode } from "react";

import { getVisibleNavItems } from "@/config/nav";
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
 * already-filtered list to the client-only `SidebarNav` — the
 * permission check itself never runs in the browser.
 */
export function AppShell({ user, children }: AppShellProps) {
  const navItems = getVisibleNavItems(user.role).map(({ href, label }) => ({
    href,
    label,
  }));

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-64 flex-col justify-between border-r border-border bg-background p-4">
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
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
