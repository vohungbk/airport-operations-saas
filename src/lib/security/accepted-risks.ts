/**
 * Security coverage gaps that someone has decided to accept (VI-F08-S02, spec E1).
 *
 * `security-coverage.test.ts` fails, and so does the tests gate of
 * `npm run release:gates`, while a permission rule or a table has no automated
 * test. The gap is closed by writing the test. Only when the risk is accepted on
 * purpose does it go here, with who accepted it, when and why; the release then
 * goes on and the gap stays on record. An entry whose gap is gone is stale and
 * fails the check, so the list only ever holds gaps that exist.
 */
export interface AcceptedRisk {
  /** The id of the gap, as the failing check prints it (e.g. `guard:src/...`). */
  item: string;
  reason: string;
  accepted_by: string;
  /** `YYYY-MM-DD`. */
  accepted_on: string;
}

export const ACCEPTED_RISKS: readonly AcceptedRisk[] = [];
