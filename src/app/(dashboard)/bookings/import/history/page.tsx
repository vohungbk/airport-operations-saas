import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  BOOKINGS_IMPORT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { ImportHistoryEmpty } from "@/features/bookings/components/import-history-empty";
import { ImportHistoryRegister } from "@/features/bookings/components/import-history-register";
import { ImportHistoryScreen } from "@/features/bookings/components/import-history-screen";
import { ImportPermissionDenied } from "@/features/bookings/components/import-permission-denied";
import { getBookingImportFilterOptions, getBookingImports } from "@/features/bookings/lib/get-booking-imports";
import { bookingImportsQuerySchema } from "@/features/bookings/schemas/booking-imports-query.schema";

interface ImportHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * CO-F07-S07: the history of imports, reached from the import screen. Anyone who may enter `/bookings` arrives;
 * only those who may import see the imports, the others see the permission denied state. The imports are read
 * only for those who may import, and RLS decides which rows they get.
 */
export default async function ImportHistoryPage({ searchParams }: ImportHistoryPageProps) {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  if (!hasAnyPermission(user.role, BOOKINGS_IMPORT_PERMISSIONS)) {
    return (
      <div className="flex flex-1 flex-col p-4 md:p-8">
        <ImportPermissionDenied />
      </div>
    );
  }

  const requested = bookingImportsQuerySchema.parse(await searchParams);
  const [result, options] = await Promise.all([getBookingImports(requested), getBookingImportFilterOptions()]);
  const filters = { ...requested, page: result.page };

  return (
    <ImportHistoryScreen filters={filters} options={options}>
      {result.total === 0 ? <ImportHistoryEmpty /> : <ImportHistoryRegister result={result} filters={filters} />}
    </ImportHistoryScreen>
  );
}
