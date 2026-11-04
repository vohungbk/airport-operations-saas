import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildJobsHref } from "@/features/jobs/lib/build-jobs-href";
import {
  JOB_DEADLINE_FILTERS,
  JOB_DEADLINE_FILTER_LABEL,
  type JobDeadlineFilter,
} from "@/features/jobs/lib/job-deadline";
import type { JobsQuery } from "@/features/jobs/schemas/jobs-query.schema";

interface JobsDeadlineChipsProps {
  query: JobsQuery;
}

const CHIPS: readonly { value: JobDeadlineFilter | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  ...JOB_DEADLINE_FILTERS.map((value) => ({
    value,
    label: JOB_DEADLINE_FILTER_LABEL[value],
  })),
];

/**
 * The chips of the design above the table (UI-F06-T01): All, Today and Overdue. Links, so the filter is
 * in the address and needs no script. Changing the chip goes back to page 1.
 */
export function JobsDeadlineChips({ query }: JobsDeadlineChipsProps) {
  return (
    <nav
      aria-label="Deadline"
      className="flex w-fit max-w-full flex-wrap gap-3 rounded-lg border bg-card p-4"
    >
      {CHIPS.map(({ value, label }) => {
        const active = query.deadline === value;

        return (
          <Link
            key={label}
            href={buildJobsHref(query, { deadline: value, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({
              variant: active ? "default" : "outline",
              className: "min-h-11 px-4",
            })}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
