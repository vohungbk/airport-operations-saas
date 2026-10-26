"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MoreSheet } from "@/components/layout/more-sheet";
import { getNavIcon } from "@/config/nav";
import { findActiveHref } from "@/lib/layout/active-item";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  /** The items in the bar: at most four, picked by `splitMobileNav`. */
  items: Array<{ href: string; label: string }>;
  /** The items that did not fit, for the More sheet. */
  moreItems: Array<{ href: string; label: string }>;
  user: { full_name: string; email: string; role_label: string };
}

/**
 * The look shared by the slots of the bar, each a touch target of at least 44 px. The size of the
 * label is set on the label itself, not here: `cn` (tailwind-merge) does not know `text-caption`
 * is a size and would drop it next to a `text-*` color.
 */
const SLOT_CLASS =
  "relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 bg-primary px-0.5 text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary-foreground";

/**
 * UI-F02-S03 (spec R5): the bottom navigation of a phone, below 768 px. Five slots: up to four
 * items of the role, and More. Each slot has an icon and a label; the current item is marked with
 * a bar on top, a heavier label and `aria-current="page"`. A label of up to two lines fits the
 * 64 px of a 320 px screen; a longer one is cut. The menu was filtered by role on the server;
 * this only shows it.
 */
export function BottomNav({ items, moreItems, user }: BottomNavProps) {
  const activeHref = findActiveHref(usePathname(), items);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex min-h-17 items-stretch pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {items.map((item) => {
        const isActive = item.href === activeHref;
        const Icon = getNavIcon(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              SLOT_CLASS,
              isActive
                ? "bg-primary font-semibold text-primary-foreground before:absolute before:top-0 before:h-1 before:w-8 before:rounded-b-full before:bg-primary-foreground"
                : "bg-primary text-primary-foreground/85",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2 max-w-full text-center text-caption leading-tight break-words">
              {item.label}
            </span>
          </Link>
        );
      })}
      <MoreSheet items={moreItems} user={user} slotClassName={SLOT_CLASS} />
    </nav>
  );
}
