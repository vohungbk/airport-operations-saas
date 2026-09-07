/**
 * Pure — no I/O, no Supabase dependency. Backed by
 * `Intl.supportedValuesOf("timeZone")`, which requires a Node build with
 * full ICU data (the Node default, including standard Next.js
 * build/deploy — see plan.md's risk note on reduced-ICU environments).
 */
export function isValidIanaTimezone(value: string): boolean {
  if (!value) {
    return false;
  }

  return Intl.supportedValuesOf("timeZone").includes(value);
}
