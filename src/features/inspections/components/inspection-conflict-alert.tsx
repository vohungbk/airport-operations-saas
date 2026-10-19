import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface InspectionConflictAlertProps {
  onViewRecord: () => void;
}

/**
 * Someone recorded this job first, so this save was not stored. The user's
 * entry stays on screen below the alert; nothing is replaced until they ask
 * to see the record that was kept.
 */
export function InspectionConflictAlert({
  onViewRecord,
}: InspectionConflictAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Already recorded</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        Someone recorded this inspection first. Your entry was not saved.
        <Button type="button" variant="outline" onClick={onViewRecord}>
          View the recorded inspection
        </Button>
      </AlertDescription>
    </Alert>
  );
}
