import { requirePermission } from "@/lib/auth/current-user";
import { TodayJobsList } from "@/features/jobs/components/today-jobs-list";
import { getTodaysJobs } from "@/features/jobs/lib/get-todays-jobs";
import { formatDate } from "@/features/jobs/lib/job-time";

/**
 * Today's Jobs (UI-F07-S01): the jobs assigned to the technician, the earliest first, as the design draws
 * them. `requirePermission` is the access check (defense-in-depth alongside the layout); RLS scopes the rows
 * to the technician's own jobs. A failed read throws to `error.tsx`, never an empty list.
 */
export default async function TechnicianPage() {
  const user = await requirePermission("jobs:view_assigned");
  const now = new Date();
  const today = await getTodaysJobs(now);
  const count = today.jobs.length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Today&apos;s Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          {[
            user.full_name,
            formatDate(now, "UTC"),
            today.jobs[0]?.airport?.code ?? "—",
            `${count} assigned ${count === 1 ? "job" : "jobs"}`,
          ].join(" · ")}
        </p>
      </div>
      <TodayJobsList today={today} now={now} />
    </div>
  );
}
