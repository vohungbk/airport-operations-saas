import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface CleaningConflictAlertProps {
  /** What happened and what was not saved. */
  message: string;
  onViewRecord: () => void;
}

/**
 * Someone else got there first, so this step was not stored. The user's
 * entry stays on screen; nothing is replaced until they ask to see the
 * cleaning that was kept.
 */
export function CleaningConflictAlert({
  message,
  onViewRecord,
}: CleaningConflictAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Already done</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {message}
        <Button type="button" variant="outline" onClick={onViewRecord}>
          View the cleaning
        </Button>
      </AlertDescription>
    </Alert>
  );
}
