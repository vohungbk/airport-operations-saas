/**
 * Next signals `redirect()`, `notFound()` and `forbidden()` by throwing an error whose digest starts
 * with `NEXT_`. It must reach the framework untouched, or a refused action would look like a failure
 * of the network (and a successful redirect like a failed save).
 */
export function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Runs a Server Action from a client form. A call that did not get through (network down, server
 * unreachable) becomes the given network error as a failed result instead of a thrown error, so the
 * form stays on screen with the user's entries and can try again; it is never taken as a success.
 * The signals of Next are thrown again, so a user who lost the permission is sent to the forbidden
 * page by the framework (VI-F04-S17, E11).
 */
export async function runClientAction<R extends { success: boolean }, E>(
  action: () => Promise<R>,
  networkError: E,
): Promise<R | { success: false; error: E }> {
  try {
    return await action();
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    return { success: false, error: networkError };
  }
}
