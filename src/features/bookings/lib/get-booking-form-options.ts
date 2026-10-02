import { createClient } from "@/lib/supabase/server";

interface Option {
  value: string;
  label: string;
}

export interface BookingFilterOptions {
  airports: Option[];
}

export interface BookingFormOptions extends BookingFilterOptions {
  partners: Option[];
  categories: Option[];
  /** Airport id -> IANA timezone, so the form can label times correctly. */
  airport_timezones: Record<string, string>;
}

function toAirportOption(airport: {
  id: string;
  code: string;
  name: string;
}): Option {
  return { value: airport.id, label: `${airport.code} - ${airport.name}` };
}

/** Airports for the list filter; RLS decides which are visible. */
export async function getBookingFilterOptions(): Promise<BookingFilterOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select("id, code, name")
    .order("code", { ascending: true });

  if (error) {
    throw error;
  }

  return { airports: (data ?? []).map(toAirportOption) };
}

/**
 * Server-only dropdown data for the create form (admin/ops only — the
 * caller guards with `bookings:manage`). Only active partners and active
 * categories are offered.
 */
export async function getBookingFormOptions(): Promise<BookingFormOptions> {
  const supabase = await createClient();

  const [partners, airports, categories] = await Promise.all([
    supabase
      .from("partners")
      .select("id, name, code")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("airports")
      .select("id, code, name, timezone")
      .order("code", { ascending: true }),
    supabase
      .from("seat_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  for (const { error } of [partners, airports, categories]) {
    if (error) {
      throw error;
    }
  }

  return {
    partners: (partners.data ?? []).map((partner) => ({
      value: partner.id,
      label: `${partner.name} (${partner.code})`,
    })),
    airports: (airports.data ?? []).map(toAirportOption),
    categories: (categories.data ?? []).map((category) => ({
      value: category.id,
      label: category.name,
    })),
    airport_timezones: Object.fromEntries(
      (airports.data ?? []).map((airport) => [airport.id, airport.timezone]),
    ),
  };
}
