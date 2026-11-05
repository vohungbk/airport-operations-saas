import { type NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/api/cron-auth";
import { apiError } from "@/lib/api/response";
import { getCronSecret } from "@/lib/config/server-env";
import { refreshFlights } from "@/features/flights/lib/refresh-flights";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** A run asks the source for many flights, so it is given time to finish where the host limits it. */
export const maxDuration = 300;

/**
 * VI-F02-S03: refreshes every linked flight that is due (spec R7). A scheduler calls it every 5 minutes with
 * `Authorization: Bearer <CRON_SECRET>`; each flight decides for itself whether it is due (30 minutes from
 * 24 hours before the arrival, 5 minutes in the last 3 hours). Nobody signs in for it, so the secret is the
 * only access check, and it is checked before anything else. The answer to a failure is the standardized
 * error shape; no error text of the source or the database is returned.
 */
export async function POST(request: NextRequest) {
  let expected_token: string;
  try {
    expected_token = getCronSecret();
  } catch {
    // Not configured: nobody can be authorized. It answers like a wrong secret, so a caller learns nothing about the setup.
    return apiError("UNAUTHORIZED", "A valid secret is required.");
  }

  if (!isCronAuthorized(request.headers.get("authorization"), expected_token)) {
    return apiError("UNAUTHORIZED", "A valid secret is required.");
  }

  try {
    const summary = await refreshFlights(createServiceRoleClient());
    return NextResponse.json({ data: summary }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return apiError("INTERNAL_ERROR", "The flights could not be refreshed. Please try again.");
  }
}
