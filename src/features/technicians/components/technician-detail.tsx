import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { TechnicianStatusBadge } from "@/features/technicians/components/technician-status-badge";
import type { Technician } from "@/features/technicians/types";

interface TechnicianDetailProps {
  technician: Technician;
}

/**
 * Read-only. The job list for this technician is not available yet (Job
 * List, FO-F01-S02), so that section says so explicitly instead of
 * showing an empty or zero value that would look like real data.
 */
export function TechnicianDetail({ technician }: TechnicianDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {technician.full_name}
          </h1>
          <TechnicianStatusBadge is_active={technician.is_active} />
        </div>
        <Link
          href="/technicians"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to technicians
        </Link>
      </div>

      <dl className="grid max-w-md grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="text-foreground">{technician.email}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd className="text-foreground">
          {new Date(technician.created_at).toLocaleDateString()}
        </dd>
      </dl>

      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium text-foreground">Jobs</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Not available yet — the job list for a technician ships with Job List
          (FO-F01-S02).
        </p>
      </div>
    </div>
  );
}
