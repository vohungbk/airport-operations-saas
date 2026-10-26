import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { getVisibleNavItems } from "@/config/nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileAppBar } from "@/components/layout/mobile-app-bar";
import { TopBar } from "@/components/layout/top-bar";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/shared/skip-link";
import type { AppUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { splitMobileNav } from "@/lib/layout/mobile-nav";
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
 * the top bar (UI-F02-S02); below it, under the app bar, with the bottom
 * navigation and the More sheet (UI-F02-S03).
 */
export async function AppShell({ user, children }: AppShellProps) {
  const navItems = getVisibleNavItems(user.role).map(({ href, label }) => ({
    href,
    label,
  }));
  const initialCollapsed = parseSidebarCollapsed(
    (await cookies()).get(SIDEBAR_COOKIE)?.value,
  );

  const { bottom, more } = splitMobileNav(navItems, user.role);
  const userInfo = {
    full_name: user.full_name,
    email: user.email,
    role_label: ROLE_LABELS[user.role],
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <SkipLink />
      <MobileAppBar items={navItems} />
      <DesktopSidebar items={navItems} initialCollapsed={initialCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar items={navItems} user={userInfo} />
        {/* 84 px, plus the safe area of a phone, keep the end of the content clear of the bottom bar (R11). */}
        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:pb-0"
        >
          {children}
        </main>
      </div>
      <BottomNav items={bottom} moreItems={more} user={userInfo} />
    </div>
  );
}
