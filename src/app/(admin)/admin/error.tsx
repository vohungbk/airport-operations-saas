"use client";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface WorkflowBoardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Never renders `error.message`: raw errors must not reach the client. */
export default function WorkflowBoardError({ reset }: WorkflowBoardErrorProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>The board could not be loaded.</AlertTitle>
      </Alert>
      <Button variant="outline" className="min-h-11 px-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
