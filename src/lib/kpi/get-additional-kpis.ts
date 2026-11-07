import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  averagePreparationFigure,
  averageRentalDurationFigure,
  complaintsFigure,
  installationTimeFigure,
  inventoryBufferFigure,
  refundsFigure,
  replacementRateFigure,
  seatUtilisationFigure,
  type BookingCounts,
  type InventoryCounts,
  type InventoryFigure,
  type MeasureFigure,
  type NotAvailableFigure,
  type RefundsFigure,
  type ReplacementFigure,
} from "@/lib/kpi/additional-kpi-figures";
import { counts } from "@/lib/kpi/get-kpi-figures";
import { kpiPeriodSchema } from "@/lib/kpi/kpi-period.schema";
import type { Database } from "@/types/database.types";

/**
 * Server-only. The additional KPIs of the KPI dashboard for `[from, to)` (VI-F05-S02, R2), except Monthly
 * partner revenue, which is the figure of Commercial performance and is taken from the core KPIs so both
 * tiles show the same value (E6). The booking figures are read as the signed-in user, so RLS is the scope;
 * the seat stock is the one read that is the same for every partner (see the migration). A read that fails
 * gives `ok: false`, so the page can show its error state instead of a made-up number.
 */

export interface AdditionalKpis {
  seat_utilisation: MeasureFigure;
  average_rental_duration: MeasureFigure;
  inventory_buffer: InventoryFigure;
  replacement_rate: ReplacementFigure;
  average_preparation: MeasureFigure;
  installation_time: MeasureFigure;
  refunds: RefundsFigure;
  complaints: NotAvailableFigure;
}

export type AdditionalKpisResult =
  | { ok: true; kpis: AdditionalKpis }
  | { ok: false; reason: "invalid_period" | "unavailable" };

export async function getAdditionalKpis(
  period: { from: string; to: string },
  supabase?: SupabaseClient<Database>,
): Promise<AdditionalKpisResult> {
  if (!kpiPeriodSchema.safeParse(period).success) return { ok: false, reason: "invalid_period" };

  try {
    const client = supabase ?? (await createClient());
    const args = { p_from: period.from, p_to: period.to };
    const [booking, inventory] = await Promise.all([
      client.rpc("kpi_additional_figures", args),
      client.rpc("kpi_seat_inventory_figures", args),
    ]);
    const bookingRow = booking.data?.[0];
    const inventoryRow = inventory.data?.[0];

    if (booking.error || inventory.error || !bookingRow || !inventoryRow) return { ok: false, reason: "unavailable" };

    const bookings: BookingCounts = counts(bookingRow);
    const { airport_codes, ...numbers } = inventoryRow;
    const seats: InventoryCounts = { ...counts(numbers), airport_codes };

    return {
      ok: true,
      kpis: {
        seat_utilisation: seatUtilisationFigure(bookings, seats),
        average_rental_duration: averageRentalDurationFigure(bookings),
        inventory_buffer: inventoryBufferFigure(seats),
        replacement_rate: replacementRateFigure(bookings),
        average_preparation: averagePreparationFigure(bookings),
        installation_time: installationTimeFigure(bookings),
        refunds: refundsFigure(bookings),
        complaints: complaintsFigure(),
      },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
