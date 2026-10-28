import type { JobActionError, JobActionResult } from "@/features/jobs/lib/job-errors";
import { NETWORK_ERROR } from "@/features/jobs/lib/job-errors";

/**
 * Next signals `redirect()` / `notFound()` by throwing an error whose digest
 * starts with `NEXT_`. It must reach the framework untouched.
 */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Runs a job Server Action from a client form. A failed call (network down,
 * server unreachable) becomes a `NETWORK_ERROR` result instead of a thrown
 * error, so the form stays on screen with the user's input and can retry.
 * Redirects and other Next signals are re-thrown.
 */
export async function runJobAction<T extends JobActionResult>(
  action: () => Promise<T>,
): Promise<T | { success: false; error: JobActionError }> {
  try {
    return await action();
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    return { success: false, error: NETWORK_ERROR };
  }
}
