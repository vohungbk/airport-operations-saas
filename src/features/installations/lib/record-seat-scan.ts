import { createClient } from "@/lib/supabase/server";
import type { ScannedCode } from "@/features/installations/lib/seat-scan";

/**
 * Server-only. Writes one scan of an installation job to the scan log (VI-F05-T01), so the installation
 * can say whether the scanned seat was the allocated one. The database looks the code up and decides
 * the match itself; the app sends only the code. The log is a record, not a gate: when it cannot be
 * written the technician still sees the result of the scan, so a failure is swallowed, never thrown.
 */
export async function recordSeatScan(jobId: string, code: ScannedCode): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_installation_seat_scan", {
      p_job_id: jobId,
      p_kind: code.kind,
      p_value: code.kind === "token" ? code.token : code.serial,
    });
  } catch {
    // The log is a record, not a gate: see above.
  }
}
