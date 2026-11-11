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

interface Chip {
  key: string;
  label: string;
  deadline: JobDeadlineFilter | undefined;
  unassigned: "1" | undefined;
}

const CHIPS: readonly Chip[] = [
  { key: "all", label: "All", deadline: undefined, unassigned: undefined },
  ...JOB_DEADLINE_FILTERS.map((value) => ({
    key: value,
    label: JOB_DEADLINE_FILTER_LABEL[value],
    deadline: value,
    unassigned: undefined,
  })),
  { key: "unassigned", label: "Unassigned", deadline: undefined, unassigned: "1" },
];

/**
 * The chips of the design above the table: All, Today, Overdue and Unassigned. Links, so the filter is
 * in the address and needs no script. Changing the chip goes back to page 1.
 */
export function JobsDeadlineChips({ query }: JobsDeadlineChipsProps) {
  return (
    <nav
      aria-label="Deadline"
      className="flex w-fit max-w-full flex-wrap gap-3 rounded-lg border border-border bg-surface p-4"
    >
      {CHIPS.map(({ key, label, deadline, unassigned }) => {
        const active = query.deadline === deadline && query.unassigned === unassigned;

        return (
          <Link
            key={key}
            href={buildJobsHref(query, { deadline, unassigned, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({
              variant: active ? "default" : "outline",
              className: "min-h-11 rounded-lg px-4",
            })}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
