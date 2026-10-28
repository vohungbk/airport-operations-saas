"use server";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";
import {
  NOT_FOUND_ERROR,
  VALIDATION_ERROR,
} from "@/features/jobs/lib/job-errors";
import { getInstallationContext } from "@/features/installations/lib/get-installation-context";
import { getSeatLastChecks } from "@/features/installations/lib/get-seat-last-checks";
import { SEAT_REQUIRED_ERROR } from "@/features/installations/lib/installation-errors";
import { parseScannedCode } from "@/features/installations/lib/seat-scan";
import type { VerifySeatScanResult } from "@/features/installations/lib/seat-scan-result";
import { verifySeatScanSchema } from "@/features/installations/schemas/verify-seat-scan.schema";
import { getSeatBySerial } from "@/features/seats/lib/get-seat-by-serial";
import { getSeatByPublicToken } from "@/features/seats/lib/get-seat-by-token";

/**
 * UI-F07-S02 (spec R8): checks a scanned or typed code against the seat of the job. It only reads: a scan
 * grants nothing, and recording the installation checks the job, the seat and the technician again
 * (`recordInstallationAction`). The job is read through RLS, so another technician's job is "not found".
 * A code of a seat RLS hides from the technician is a mismatch, not an error: the screen must not tell
 * whether such a seat exists.
 */
export async function verifySeatScanAction(
  input: unknown,
): Promise<VerifySeatScanResult> {
  await requireAnyPermission(INSTALLATION_RECORD_PERMISSIONS);

  const parsed = verifySeatScanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const code = parseScannedCode(parsed.data.code);
  if (!code) {
    return { success: false, error: VALIDATION_ERROR };
  }

  const context = await getInstallationContext(parsed.data.job_id);
  if (!context) {
    return { success: false, error: NOT_FOUND_ERROR };
  }

  const assigned = context.booking.seat;
  if (!assigned) {
    return { success: false, error: SEAT_REQUIRED_ERROR };
  }

  const scannedSeat =
    code.kind === "token"
      ? await getSeatByPublicToken(code.token)
      : await getSeatBySerial(code.serial);
  const match = scannedSeat?.id === assigned.id;

  return {
    success: true,
    scan: {
      match,
      assigned: {
        serial_number: assigned.serial_number,
        category_name: assigned.category_name,
        airport_code: context.booking.airport.code,
      },
      scanned: {
        serial_number:
          scannedSeat?.serial_number ??
          (code.kind === "serial" ? code.serial : null),
        category_name: scannedSeat?.category?.name ?? null,
        status: scannedSeat?.status ?? null,
      },
      checks: match ? await getSeatLastChecks(assigned.id) : null,
    },
  };
}
