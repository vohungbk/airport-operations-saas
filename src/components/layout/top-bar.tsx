import { Breadcrumb } from "@/components/layout/breadcrumb";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeControl } from "@/components/theme/theme-control";

interface TopBarProps {
  items: Array<{ href: string; label: string }>;
  user: { full_name: string; email: string; role_label: string };
}

/**
 * UI-F02-S02 (spec R3, R4): the top bar of the wide screens (768 px and up), above the content:
 * the breadcrumb on the left, the theme control and the account menu on the right. Search and
 * the notification bell are not here yet: what they find and count is still an open question
 * (spec Q1, Q2). Narrow screens have the app bar instead.
 */
export function TopBar({ items, user }: TopBarProps) {
  return (
    <header className="hidden h-11 shrink-0 items-center gap-3 border-b border-border bg-surface-muted px-4 md:flex print:hidden">
      <Breadcrumb items={items} />
      <div className="ml-auto flex items-center gap-1">
        <ThemeControl />
        <UserMenu {...user} />
      </div>
    </header>
  );
}
