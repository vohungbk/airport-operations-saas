import { z } from "zod";

import { JOB_DEADLINE_FILTERS } from "@/features/jobs/lib/job-deadline";
import { JOB_STATUSES } from "@/features/jobs/lib/job-status";
import { JOB_TYPES } from "@/features/jobs/lib/job-type";
import {
  getJobSearchError,
  JOB_SEARCH_MAX_LENGTH,
} from "@/features/jobs/lib/job-search";

/**
 * Explicit column allowlist for the `sort` query param — never
 * interpolate a raw `searchParams` value into `.order()`.
 */
const JOBS_SORT_COLUMNS = ["assigned_at", "status"] as const;

export type JobsSortColumn = (typeof JOBS_SORT_COLUMNS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const JOBS_DEFAULT_SORT: JobsSortColumn = "assigned_at";
const JOBS_DEFAULT_PAGE_SIZE = 20;
const JOBS_MAX_PAGE_SIZE = 100;

/**
 * `z.guid()` rather than `z.uuid()`: seeded ids are not RFC-variant
 * UUIDs (same choice as the other features' id schemas).
 */
export const jobIdSchema = z.guid();

/**
 * `searchParams` is user-editable URL state — garbled values fall back
 * to safe defaults via `.catch()` instead of failing the page. An
 * over-long `q` is rejected by `parseJobsQuery` first, so it produces a
 * visible error rather than being dropped silently.
 */
export const jobsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(JOB_SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
  status: z.enum(JOB_STATUSES).optional().catch(undefined),
  technician_id: z.guid().optional().catch(undefined),
  deadline: z.enum(JOB_DEADLINE_FILTERS).optional().catch(undefined),
  type: z.enum(JOB_TYPES).optional().catch(undefined),
  airport_id: z.guid().optional().catch(undefined),
  /** Deadline range, `YYYY-MM-DD` in the airport time zone; either end may be left out. */
  from: z.string().regex(ISO_DATE).optional().catch(undefined),
  to: z.string().regex(ISO_DATE).optional().catch(undefined),
  /** The Unassigned chip: `1` lists the jobs with no technician. */
  unassigned: z.enum(["1"]).optional().catch(undefined),
  sort: z.enum(JOBS_SORT_COLUMNS).catch(JOBS_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(JOBS_MAX_PAGE_SIZE)
    .catch(JOBS_DEFAULT_PAGE_SIZE),
});

export type JobsQuery = z.infer<typeof jobsQuerySchema>;

export interface ParsedJobsQuery {
  query: JobsQuery;
  /** Message to show when `q` failed validation; the filter is not applied then. */
  search_error: string | null;
}

export function parseJobsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedJobsQuery {
  const rawQ = typeof raw.q === "string" ? raw.q : undefined;
  const search_error = rawQ === undefined ? null : getJobSearchError(rawQ);

  return {
    query: jobsQuerySchema.parse({ ...raw, q: search_error ? undefined : rawQ }),
    search_error,
  };
}
