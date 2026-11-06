/** Why the flight source could not answer, most serious first. Only this kind is stored; the source's own message never is. */
export const PROVIDER_ERROR_KINDS = ["rate_limited", "timeout", "unavailable", "invalid_response"] as const;

export type ProviderErrorKind = (typeof PROVIDER_ERROR_KINDS)[number];

/** A failure of the flight source (spec R12): the stored flight data is kept when one is raised. */
export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** The kind of any error raised while asking a source; what is not recognized counts as unavailable. */
export function toProviderErrorKind(error: unknown): ProviderErrorKind {
  if (error instanceof ProviderError) return error.kind;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "unavailable";
}
