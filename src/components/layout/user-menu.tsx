"use client";

import { LogOut, User } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/features/auth/actions/logout.action";

interface UserMenuProps {
  full_name: string;
  email: string;
  /** The role as a person reads it, from `ROLE_LABELS`. */
  role_label: string;
}

/**
 * UI-F02-S02 (spec R4): the account menu of the top bar. It shows the name, the role and the
 * email of the signed-in user, and Sign out. The values come from the profile the server read;
 * the menu decides nothing about access.
 */
export function UserMenu({ full_name, email, role_label }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Account menu, ${full_name}`}
          />
        }
      >
        <User aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium text-foreground">{full_name}</p>
          <p className="text-xs text-muted-foreground">{role_label}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onClick={() => startTransition(() => logoutAction())}
        >
          <LogOut aria-hidden="true" />
          {isPending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
