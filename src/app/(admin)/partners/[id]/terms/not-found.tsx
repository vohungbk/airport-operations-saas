import { PageNotFound } from "@/components/shared/page-state";

export default function CommercialTermsNotFound() {
  return (
    <PageNotFound
      title="Partner not found"
      description="This partner does not exist."
      backHref="/partners"
      backLabel="Back to partners"
    />
  );
}
