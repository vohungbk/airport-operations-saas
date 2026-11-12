import { Button } from "@/components/ui/button";

interface IncidentPhotosPanelProps {
  /** `04 Nov 2026 11:15 GST`: when the photos would be added. */
  stamp: string;
}

/**
 * The Photos (optional) box of the design. Photo upload is not built yet
 * (it waits for the photo storage work), so the two buttons are disabled.
 */
export function IncidentPhotosPanel({ stamp }: IncidentPhotosPanelProps) {
  return (
    <section aria-labelledby="incident-photos-title" className="flex flex-col gap-4">
      <h2
        id="incident-photos-title"
        className="text-base font-semibold text-foreground"
      >
        Photos (optional)
      </h2>
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-input p-4">
        <p className="text-sm font-semibold">Add incident photos</p>
        <p className="text-xs text-text-muted">{stamp}</p>
        <p className="text-xs text-text-muted">
          Choose JPG or PNG files, or take a photo. Maximum 10 MB per photo.
        </p>
        <div className="flex flex-col gap-2 sm:max-w-44">
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 rounded-lg bg-surface px-4"
          >
            Open camera
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-11 rounded-lg bg-surface px-4"
          >
            Choose files
          </Button>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        JPG or PNG - up to 10 MB per photo. Neutral seat, strap or car interior
        evidence only.
      </p>
    </section>
  );
}
