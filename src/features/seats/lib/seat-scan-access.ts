import type { Role } from "@/lib/auth/roles";
import {
  CLEANING_RECORD_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";

export interface SeatScanView {
  /** Operations roles go to the full seat page, which they already have. */
  openFullDetail: boolean;
  /** Staff see why a seat is in quarantine; a partner does not (as in the partner seat list). */
  showQuarantineReason: boolean;
  /** The link to the cleaning of the seat, for those who may record a cleaning. */
  showCleaningLink: boolean;
  /** Where "back" goes. */
  backHref: string;
  backLabel: string;
}

/**
 * CO-F04-S13: what a scan shows each role. The scan identifies the seat and nothing more; this
 * only chooses how much of the seat the role may read and which links it is offered. The
 * actions behind the links check the permission again on the server.
 */
export function getSeatScanView(role: Role): SeatScanView {
  const staff = hasAnyPermission(role, CLEANING_RECORD_PERMISSIONS);
  const partner = !staff && hasPermission(role, "seats:view_own_partner");

  return {
    openFullDetail: hasPermission(role, "seats:manage"),
    showQuarantineReason: staff,
    showCleaningLink: staff,
    backHref: partner ? "/partner/seats" : "/jobs",
    backLabel: partner ? "Back to seats" : "Back to jobs",
  };
}
