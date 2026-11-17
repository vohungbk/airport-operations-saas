"use client";

import { Button } from "@/components/ui/button";
import { PartnersPageHeader } from "@/features/partners/components/partners-page-header";
import { PartnersSearch } from "@/features/partners/components/partners-search";
import { PartnersStateCard } from "@/features/partners/components/partners-state-card";

interface PartnersErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Never renders `error.message`: a raw error must not reach the client. */
export default function PartnersError({ reset }: PartnersErrorProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PartnersPageHeader />
      <PartnersSearch query={null} />
      <PartnersStateCard
        role="alert"
        title="Unable to load partners"
        description="Check your connection and try again."
      >
        <Button onClick={reset} className="min-h-11 px-4">
          Try again
        </Button>
      </PartnersStateCard>
    </div>
  );
}
