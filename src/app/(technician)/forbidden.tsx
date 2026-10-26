import { PageForbidden } from "@/components/shared/page-state";

/**
 * Shown by `forbidden()` (a 403) inside the shell of this group, so the menu stays usable.
 * The text is the same for every case and does not say which permission is missing.
 */
export default function Forbidden() {
  return <PageForbidden />;
}
