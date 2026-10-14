"use client";

import { Menu } from "lucide-react";
import type { MouseEvent } from "react";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useMobileNav } from "@/components/layout/use-mobile-nav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogoutButton } from "@/features/auth/components/logout-button";

interface MobileNavProps {
  user: { full_name: string; email: string };
  items: Array<{ href: string; label: string }>;
}

/**
 * Small-screen navigation drawer. Built on the shared `Dialog`, so focus
 * is trapped while open, Esc closes it and focus returns to the menu
 * button. Receives the nav items already filtered by role server-side.
 */
export function MobileNav({ user, items }: MobileNavProps) {
  const { open, setOpen, close } = useMobileNav();

  // A link to the current page does not change the pathname, so close
  // explicitly when any link inside the drawer is activated.
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) close();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        className="top-0 left-0 h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 content-start rounded-none p-4 sm:max-w-72 md:hidden data-open:slide-in-from-left data-open:zoom-in-100"
        onClick={handleClick}
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <div>
          <p className="text-sm font-medium text-foreground">
            {user.full_name}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <SidebarNav items={items} />
        <LogoutButton />
      </DialogContent>
    </Dialog>
  );
}
