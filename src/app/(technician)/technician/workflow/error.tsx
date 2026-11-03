"use client";

import { PageError } from "@/components/shared/page-error";

interface TechnicianWorkflowErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TechnicianWorkflowError({ reset }: TechnicianWorkflowErrorProps) {
  return <PageError title="The board could not be loaded." reset={reset} />;
}
