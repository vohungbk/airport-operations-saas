import {
  JobFormPage,
  JobFormSkeleton,
} from "@/features/jobs/components/job-form-page";

export default function NewJobLoading() {
  return (
    <JobFormPage
      crumbs={[{ label: "Jobs", href: "/jobs" }, { label: "Create job" }]}
      title="Create job"
      description="Assign a technician to an airport operation."
    >
      <JobFormSkeleton cardDescription="Choose a job type, technician and related record." />
    </JobFormPage>
  );
}
