import type { ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Alert } from "@/components/ui/alert";

interface WorkflowStateMessageProps {
  /** The heading of the page header, for example "Booking". */
  title: string;
  /** The line of the page header under the title. */
  subtitle?: string;
  /** The one sentence of the state. It is the main heading of the page. */
  message: string;
  /** What to do next: a link or a button. */
  children: ReactNode;
}

/**
 * The error, not found and permission denied states of the booking workflow screen, in the layout of
 * the design: the page header, then one message in a box with the action under it.
 */
export function WorkflowStateMessage({
  title,
  subtitle = "Booking workflow",
  message,
  children,
}: WorkflowStateMessageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-col gap-1 border-b border-border bg-card px-6 py-5">
        <p className="text-xl font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Alert className="w-full max-w-md bg-primary-subtle text-foreground">
          <TriangleAlertIcon aria-hidden="true" />
          <h1 className="font-medium">{message}</h1>
        </Alert>
        {children}
      </div>
    </div>
  );
}
