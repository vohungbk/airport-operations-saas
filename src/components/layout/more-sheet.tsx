"use client";

import { ChevronRight, Ellipsis } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { useMobileNav } from "@/components/layout/use-mobile-nav";
import { ThemeControl } from "@/components/theme/theme-control";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { getNavIcon } from "@/config/nav";

interface MoreSheetProps {
  /** The items of the menu that are not in the bottom bar. */
  items: Array<{ href: string; label: string }>;
  user: { full_name: string; email: string; role_label: string };
  /** The classes of the More slot of the bar, so it looks like the other slots. */
  slotClassName: string;
}

/**
 * UI-F02-S03 (spec R6): the More slot of the bottom bar and the sheet it opens. The sheet lists
 * the items that did not fit in the bar, the theme control, and the name and role of the user with
 * Sign out. It is built on the shared `Dialog`, so focus stays inside while it is open, Esc closes
 * it and focus returns to the More button. It closes when the user picks an item or the page
 * changes.
 */
export function MoreSheet({ items, user, slotClassName }: MoreSheetProps) {
  const { open, setOpen, close } = useMobileNav();

  // A link to the current page does not change the pathname, so close explicitly when a link in
  // the sheet is activated.
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" aria-label="More" aria-haspopup="dialog" className={slotClassName} />
        }
      >
        <Ellipsis className="size-5" aria-hidden="true" />
        <span className="text-caption">More</span>
      </DialogTrigger>
      <DialogContent
        className="top-auto bottom-0 left-0 max-h-[85vh] w-full max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-t-xl rounded-b-none p-4 sm:max-w-none md:hidden data-open:slide-in-from-bottom data-open:zoom-in-100"
        onClick={handleClick}
      >
        <DialogTitle className="text-lg font-semibold">More</DialogTitle>
        {items.length > 0 && (
          <nav aria-label="More">
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((item) => {
                const Icon = getNavIcon(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <span className="text-sm text-foreground">Theme</span>
          <ThemeControl />
        </div>
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{user.role_label}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <LogoutButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}
