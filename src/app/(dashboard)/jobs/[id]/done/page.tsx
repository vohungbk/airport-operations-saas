import { notFound, redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOBS_ACCESS_PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { StepDone } from "@/features/jobs/components/step-done";
import { getStepDone } from "@/features/jobs/lib/get-step-done";
import { getTodaysJobs } from "@/features/jobs/lib/get-todays-jobs";
import { stepSchema } from "@/features/jobs/lib/step-done";
import { pickNextJob } from "@/features/jobs/lib/todays-jobs";

interface StepDonePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * UI-F07-S03: where a step ends. The page reads the record of the step: if there is none (the step was not
 * done, or the job is not the user's) it sends the user to the job screen, which says not found for a job
 * that is not theirs. The next job is only for a technician (it is the next of their day); a failed read of
 * the jobs keeps the success screen and offers the way back, never an invented job.
 */
export default async function StepDonePage({ params, searchParams }: StepDonePageProps) {
  const user = await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const step = stepSchema.safeParse((await searchParams).step);

  if (!step.success) {
    notFound();
  }

  const done = await getStepDone(id, step.data);

  if (!done) {
    redirect(`/jobs/${id}`);
  }

  const isTechnician = hasPermission(user.role, "jobs:view_assigned");
  const nextJob = isTechnician
    ? await getTodaysJobs()
        .then((today) => pickNextJob(today.jobs, id))
        .catch(() => undefined)
    : undefined;

  return (
    <StepDone
      done={done}
      nextJobId={nextJob?.id ?? null}
      backHref={isTechnician ? "/technician" : "/jobs"}
      backLabel={isTechnician ? "Back to Today's Jobs" : "Back to jobs"}
    />
  );
}
