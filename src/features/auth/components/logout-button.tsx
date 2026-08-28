"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions/logout.action";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => logoutAction())}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
