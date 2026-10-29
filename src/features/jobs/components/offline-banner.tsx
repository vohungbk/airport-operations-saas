"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useOnlineStatus } from "@/features/jobs/hooks/use-online-status";

/**
 * Shown while the phone has no connection, in the middle of a step (UI-F07-S04, AC03). What was entered stays
 * on screen; the banner goes away when the connection is back.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <Alert variant="destructive" data-slot="offline-banner">
      <AlertTitle>No connection</AlertTitle>
      <AlertDescription>
        Your input is kept. Saving will work again when the connection is back.
      </AlertDescription>
    </Alert>
  );
}
