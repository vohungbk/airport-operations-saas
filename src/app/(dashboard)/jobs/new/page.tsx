import { requirePermission } from "@/lib/auth/current-user";
import { CreateJobForm } from "@/features/jobs/components/create-job-form";
import { getJobFormOptions } from "@/features/jobs/lib/get-job-form-options";

/**
 * The jobs layout lets technicians in; creating a job is admin/ops only, so
 * this page adds its own `technicians:manage` guard.
 */
export default async function NewJobPage() {
  await requirePermission("technicians:manage");

  const options = await getJobFormOptions();

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Create job
      </h1>
      <div className="max-w-lg">
        <CreateJobForm options={options} />
      </div>
    </div>
  );
}
