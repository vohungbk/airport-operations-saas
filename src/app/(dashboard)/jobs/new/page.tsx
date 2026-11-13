import { requirePermission } from "@/lib/auth/current-user";
import { JobForm } from "@/features/jobs/components/job-form";
import { JobFormPage } from "@/features/jobs/components/job-form-page";
import { getJobFormOptions } from "@/features/jobs/lib/get-job-form-options";

/**
 * The jobs layout lets technicians in; creating a job is admin/ops only, so
 * this page adds its own `technicians:manage` guard.
 */
export default async function NewJobPage() {
  await requirePermission("technicians:manage");

  const options = await getJobFormOptions();

  return (
    <JobFormPage
      crumbs={[{ label: "Jobs", href: "/jobs" }, { label: "Create job" }]}
      title="Create job"
      description="Assign a technician to an airport operation."
    >
      <JobForm options={options} />
    </JobFormPage>
  );
}
