import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { PageEmpty } from "@/components/shared/page-state";
import { getTodaysJobs } from "@/features/jobs/lib/get-todays-jobs";
import { pickJobToScan } from "@/features/jobs/lib/todays-jobs";

/**
 * The Scan item of the technician menu (UI-F07-S02): a scan is made for a job, so this sends the technician to
 * the scan of the seat of the first job of the day. With no such job there is nothing to scan. The page checks
 * the permission on the server; the scan page behind it guards itself again, and RLS scopes the jobs.
 */
export default async function TechnicianScanPage() {
  await requirePermission("jobs:view_assigned");

  const job = pickJobToScan((await getTodaysJobs()).jobs);

  if (job) {
    redirect(`/jobs/${job.id}/scan`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <PageEmpty message="No job to scan." />
    </div>
  );
}
