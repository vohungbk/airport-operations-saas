import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";

/**
 * VI-F02-S09: the Settings item of the menu opens the Provider settings, the only settings screen
 * built so far. The guard is the one of the menu item (`dashboards:view`); the page it sends to is
 * admin only, so an operations manager who clicks Settings gets the 403 there.
 */
export default async function SettingsPage() {
  await requirePermission("dashboards:view");

  redirect("/settings/flight-provider");
}
