import {
  JobFormPage,
  JobFormSkeleton,
} from "@/features/jobs/components/job-form-page";

export default function EditJobLoading() {
  return (
    <JobFormPage
      crumbs={[{ label: "Jobs", href: "/jobs" }, { label: "Edit job" }]}
      title="Edit job"
      description="Update the assignment and related booking."
    >
      <JobFormSkeleton
        withMeta
        cardDescription="Job status is changed from Job detail."
      />
    </JobFormPage>
  );
}
