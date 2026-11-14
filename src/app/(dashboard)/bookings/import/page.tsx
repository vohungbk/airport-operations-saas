import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  BOOKINGS_IMPORT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { ImportBookingsScreen } from "@/features/bookings/components/import-bookings-screen";
import { ImportPermissionDenied } from "@/features/bookings/components/import-permission-denied";
import { ImportUploadCard } from "@/features/bookings/components/import-upload-card";
import { getBookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";

/**
 * CO-F07-S01: the import screen. Anyone who may enter `/bookings` arrives; only those who may import
 * see the upload card, the others see the permission denied state (E8). Partners are read only for
 * those who may import; RLS decides which rows they get.
 */
export default async function ImportBookingsPage() {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);
  const canImport = hasAnyPermission(user.role, BOOKINGS_IMPORT_PERMISSIONS);
  const partners = canImport ? (await getBookingFormOptions()).partners : [];

  return (
    <ImportBookingsScreen>
      {canImport ? <ImportUploadCard partners={partners} /> : <ImportPermissionDenied />}
    </ImportBookingsScreen>
  );
}
