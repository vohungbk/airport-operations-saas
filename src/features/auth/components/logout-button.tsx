"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions/logout.action";

interface LogoutButtonProps {
  /** Only the icon shows (the collapsed sidebar); the name stays for screen readers and as a title. */
  iconOnly?: boolean;
}

export function LogoutButton({ iconOnly = false }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const label = isPending ? "Signing out..." : "Sign out";

  return (
    <Button
      type="button"
      variant="outline"
      size={iconOnly ? "icon" : "default"}
      disabled={isPending}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      onClick={() => startTransition(() => logoutAction())}
    >
      <LogOut className="size-4" aria-hidden="true" />
      {!iconOnly && label}
    </Button>
  );
}
