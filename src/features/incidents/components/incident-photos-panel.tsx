import { StepPhotoField } from "@/features/bookings/components/step-photo-field";
import type { useStepPhotoUpload } from "@/features/bookings/hooks/use-step-photo-upload";

interface IncidentPhotosPanelProps {
  /** `04 Nov 2026 11:15 GST`: when the photos are added. */
  stamp: string;
  /** The photos of the incident: they go to the booking of the chosen job. */
  photos: Omit<ReturnType<typeof useStepPhotoUpload>, "canSave">;
  /** No job is chosen yet, so there is no booking to add photos to. */
  disabled: boolean;
}

/**
 * The Photos box of the incident form. An incident needs at least one photo (FO-F06-S06): the form keeps
 * Submit incident off until one is stored.
 */
export function IncidentPhotosPanel({ stamp, photos, disabled }: IncidentPhotosPanelProps) {
  return (
    <section aria-labelledby="incident-photos-title" className="flex flex-col gap-4">
      <h2
        id="incident-photos-title"
        className="text-base font-semibold text-foreground"
      >
        Photos (required)
      </h2>
      <p className="text-xs text-text-muted">{stamp}</p>
      <StepPhotoField
        subject="incident"
        {...photos}
        disabled={disabled}
        disabledHint="Select a seat first, then add at least one photo."
      />
      <p className="text-xs text-text-muted">
        Neutral seat, strap or car interior evidence only.
      </p>
    </section>
  );
}
