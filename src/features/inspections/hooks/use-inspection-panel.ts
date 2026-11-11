"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useRecordInspectionForm } from "@/features/inspections/hooks/use-record-inspection-form";
import { hasUnsavedInspection } from "@/features/inspections/lib/unsaved-inspection";
import { isInspectionNotesRequired } from "@/features/inspections/schemas/record-inspection.schema";

interface UseInspectionPanelArgs {
  jobId: string;
  seatId: string;
}

/**
 * The form of the Admin and Operations Manager panel. Cancel leaves at once
 * when nothing was entered; otherwise it asks first, and nothing is saved
 * either way.
 */
export function useInspectionPanel({ jobId, seatId }: UseInspectionPanelArgs) {
  const router = useRouter();
  const base = useRecordInspectionForm({ jobId, seatId });
  const [discardOpen, setDiscardOpen] = useState(false);
  const values = base.form.watch();

  function leave() {
    base.discardDraft();
    router.push(`/jobs/${jobId}`);
  }

  function onCancel() {
    if (hasUnsavedInspection(values)) {
      setDiscardOpen(true);
      return;
    }

    leave();
  }

  return {
    ...base,
    discardOpen,
    setDiscardOpen,
    onCancel,
    onDiscard: leave,
    notesRequired: isInspectionNotesRequired(values.result),
    notesLength: values.notes?.length ?? 0,
  };
}
