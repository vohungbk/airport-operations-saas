import { z } from "zod";

/**
 * Performance targets that someone has agreed (VI-F08-S06, spec R6 and E2).
 *
 * No target is agreed yet (spec Q2 is open), so this list is empty, and the
 * measurements are only reported. Nothing is to be claimed as "fast enough" until
 * a person who can decide has agreed a number: add it here with who agreed, when,
 * and under what load. A target with a missing field is not a target, and the
 * workflow it names stays measured only.
 */
export const targetSchema = z.object({
  /** A workflow id of `measure.ts` (e.g. `list:bookings`). */
  workflow: z.string().trim().min(1),
  metric: z.literal("p95_ms"),
  /** The 95th percentile of the time of the workflow must not be more than this. */
  limit_ms: z.number().positive(),
  agreed_by: z.string().trim().min(1),
  /** `YYYY-MM-DD`. */
  agreed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  /** What the number holds for: the machine, the data and the number of users. */
  load: z.string().trim().min(1),
});

export type AgreedTarget = z.infer<typeof targetSchema>;

export const AGREED_TARGETS: readonly AgreedTarget[] = [];

export interface RejectedTarget {
  index: number;
  issues: string[];
}

/** Pure. The targets that are complete, and why each of the others is not. */
export function validateTargets(candidates: readonly unknown[]): {
  valid: AgreedTarget[];
  rejected: RejectedTarget[];
} {
  const valid: AgreedTarget[] = [];
  const rejected: RejectedTarget[] = [];

  candidates.forEach((candidate, index) => {
    const result = targetSchema.safeParse(candidate);
    if (result.success) {
      valid.push(result.data);
    } else {
      rejected.push({
        index,
        issues: result.error.issues.map((issue) => `${issue.path.join(".") || "target"}: ${issue.message}`),
      });
    }
  });

  return { valid, rejected };
}
