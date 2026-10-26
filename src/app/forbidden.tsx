import { PageForbidden } from "@/components/shared/page-state";
import { StandalonePage } from "@/components/shared/standalone-page";

/**
 * Shown by `forbidden()` (a 403) outside every group; it is the fallback of `forbidden()`.
 * The text is the same for every case and does not say which permission is missing.
 */
export default function Forbidden() {
  return (
    <StandalonePage>
      <PageForbidden />
    </StandalonePage>
  );
}
