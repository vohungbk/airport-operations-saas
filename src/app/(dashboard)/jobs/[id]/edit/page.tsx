import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { JobEditMeta } from "@/features/jobs/components/job-edit-meta";
import { JobForm } from "@/features/jobs/components/job-form";
import { JobFormPage } from "@/features/jobs/components/job-form-page";
import { getJobForEdit } from "@/features/jobs/lib/get-job-for-edit";
import { getJobFormOptions } from "@/features/jobs/lib/get-job-form-options";

interface EditJobPageProps {
  params: Promise<{ id: string }>;
}

/**
 * The jobs layout lets technicians in; editing a job is admin/ops only, so
 * this page adds its own `technicians:manage` guard. A job RLS hides looks
 * the same as a missing one.
 */
export default async function EditJobPage({ params }: EditJobPageProps) {
  await requirePermission("technicians:manage");

  const { id } = await params;
  const [job, options] = await Promise.all([
    getJobForEdit(id),
    getJobFormOptions(),
  ]);

  if (!job) {
    notFound();
  }

  return (
    <JobFormPage
      crumbs={[
        { label: "Jobs", href: "/jobs" },
        { label: job.job_number, href: `/jobs/${job.id}` },
        { label: "Edit job" },
      ]}
      title="Edit job"
      description="Update the assignment and related booking."
    >
      <JobEditMeta job={job} />
      <JobForm
        options={options}
        edit={{
          jobId: job.id,
          bookingNumber: job.booking.booking_number,
          defaultValues: {
            job_type: job.job_type,
            technician_id: job.technician_id,
            booking_id: job.booking.id,
          },
        }}
      />
    </JobFormPage>
  );
}
