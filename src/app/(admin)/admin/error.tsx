"use client";

import { PageError } from "@/components/shared/page-error";

interface WorkflowBoardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkflowBoardError({ reset }: WorkflowBoardErrorProps) {
  return <PageError title="The board could not be loaded." reset={reset} />;
}
