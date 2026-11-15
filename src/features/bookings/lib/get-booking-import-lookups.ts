import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface BookingImportLookups {
  /** The one airport the account sees, or `null` when it sees none or several. */
  airport: { id: string; timezone: string } | null;
  categoryIdsByName: Map<string, string>;
}

/**
 * Server-only. What the rows of an import are checked against (CO-F07-S03): the airport of the import
 * (the CSV has no airport column, so it is the one the account can see) and the seat categories in use.
 * RLS decides what is visible; there is no filter here for access.
 */
export async function getBookingImportLookups(supabase: ServerClient): Promise<BookingImportLookups> {
  const [airports, categories] = await Promise.all([
    supabase.from("airports").select("id, timezone"),
    supabase.from("seat_categories").select("id, name").eq("is_active", true),
  ]);

  for (const { error } of [airports, categories]) {
    if (error) throw error;
  }

  const visible = airports.data ?? [];

  return {
    airport: visible.length === 1 ? visible[0] : null,
    categoryIdsByName: new Map((categories.data ?? []).map((category) => [category.name.trim().toLowerCase(), category.id])),
  };
}

/** How many numbers go in one query: the list is part of the address of the request, so it stays short. */
const EXISTING_NUMBERS_CHUNK = 200;

/**
 * Server-only. CO-F07-S04 (R9): which of these external booking numbers the partner already has on a booking
 * of any status. One query for each chunk of numbers, never one for each row. RLS decides what is visible.
 */
export async function getExistingExternalNumbers(
  supabase: ServerClient,
  partnerId: string,
  numbers: readonly string[],
): Promise<Set<string>> {
  const unique = [...new Set(numbers.filter((number) => number !== ""))];
  const chunks: string[][] = [];
  for (let start = 0; start < unique.length; start += EXISTING_NUMBERS_CHUNK) {
    chunks.push(unique.slice(start, start + EXISTING_NUMBERS_CHUNK));
  }

  const answers = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("bookings")
        .select("external_booking_number")
        .eq("partner_id", partnerId)
        .in("external_booking_number", chunk),
    ),
  );

  const found = new Set<string>();
  for (const { data, error } of answers) {
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.external_booking_number) found.add(row.external_booking_number);
    }
  }

  return found;
}
