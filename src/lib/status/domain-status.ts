import {
  AlarmClock,
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  CircleDashed,
  CircleDot,
  CirclePlay,
  CircleX,
  Clock,
  FilePen,
  FileText,
  Flag,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Search,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  UserCheck,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { INCIDENT_SEVERITY_LABEL } from "@/features/incidents/lib/incident-severity";
import { INCIDENT_STATUS_LABEL } from "@/features/incidents/lib/incident-status";
import { JOB_STATUS_LABEL } from "@/features/jobs/lib/job-status";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import { SETTLEMENT_STATUS_LABEL } from "@/features/settlements/lib/settlement";
import type { Database } from "@/types/database.types";

/**
 * UI-F03-S04 (spec R11): one table that says how every domain status looks. A status is shown by an
 * icon and its text, with the token pair (`*-bg` / `*-fg`) of its variant, never by color alone.
 * The value types come from the database enums, so a new enum value does not compile until it has
 * an icon, a label and a variant here.
 */

type Enums = Database["public"]["Enums"];

export type StatusVariant = "success" | "warning" | "info" | "destructive" | "muted";

export interface StatusLook {
  label: string;
  variant: StatusVariant;
  icon: LucideIcon;
}

type Look<T extends string> = Record<T, StatusLook>;

/** `workflow` is the incident workflow (open, investigating, resolved, closed). */
export interface DomainStatusMap {
  seat: Look<Enums["seat_status"]>;
  workflow: Look<Enums["incident_status"]>;
  booking: Look<Enums["booking_status"]>;
  job: Look<Enums["technician_job_status"]>;
  result: Look<Enums["inspection_result"]>;
  severity: Look<Enums["incident_severity"]>;
  flight: Look<Enums["flight_status"]>;
  invoice: Look<Enums["invoice_status"]>;
  settlement: Look<Enums["settlement_status"]>;
}

export type StatusDomain = keyof DomainStatusMap;
export type StatusValue<D extends StatusDomain> = keyof DomainStatusMap[D] & string;

const look = (label: string, variant: StatusVariant, icon: LucideIcon): StatusLook => ({
  label,
  variant,
  icon,
});

export const DOMAIN_STATUS: DomainStatusMap = {
  seat: {
    available: look(SEAT_STATUS_LABEL.available, "success", CircleCheck),
    reserved: look(SEAT_STATUS_LABEL.reserved, "info", Clock),
    in_use: look(SEAT_STATUS_LABEL.in_use, "info", CirclePlay),
    cleaning: look(SEAT_STATUS_LABEL.cleaning, "warning", Sparkles),
    inspection: look(SEAT_STATUS_LABEL.inspection, "warning", Search),
    quarantine: look(SEAT_STATUS_LABEL.quarantine, "destructive", ShieldAlert),
    retired: look(SEAT_STATUS_LABEL.retired, "muted", Ban),
  },
  workflow: {
    open: look(INCIDENT_STATUS_LABEL.open, "warning", CircleDot),
    investigating: look(INCIDENT_STATUS_LABEL.investigating, "info", Search),
    resolved: look(INCIDENT_STATUS_LABEL.resolved, "success", CircleCheckBig),
    closed: look(INCIDENT_STATUS_LABEL.closed, "muted", CircleX),
  },
  booking: {
    pending: look(BOOKING_STATUS_LABEL.pending, "warning", Clock),
    confirmed: look(BOOKING_STATUS_LABEL.confirmed, "info", CircleCheck),
    assigned: look(BOOKING_STATUS_LABEL.assigned, "info", UserCheck),
    in_progress: look(BOOKING_STATUS_LABEL.in_progress, "info", CirclePlay),
    completed: look(BOOKING_STATUS_LABEL.completed, "success", CircleCheckBig),
    cancelled: look(BOOKING_STATUS_LABEL.cancelled, "muted", CircleX),
    no_show: look(BOOKING_STATUS_LABEL.no_show, "destructive", UserX),
  },
  job: {
    assigned: look(JOB_STATUS_LABEL.assigned, "info", UserCheck),
    in_progress: look(JOB_STATUS_LABEL.in_progress, "info", CirclePlay),
    completed: look(JOB_STATUS_LABEL.completed, "success", CircleCheckBig),
    cancelled: look(JOB_STATUS_LABEL.cancelled, "muted", CircleX),
  },
  result: {
    pass: look("Pass", "success", BadgeCheck),
    conditional_pass: look("Conditional pass", "warning", TriangleAlert),
    fail: look("Fail", "destructive", CircleX),
  },
  severity: {
    low: look(INCIDENT_SEVERITY_LABEL.low, "muted", Flag),
    medium: look(INCIDENT_SEVERITY_LABEL.medium, "warning", Flag),
    high: look(INCIDENT_SEVERITY_LABEL.high, "destructive", CircleAlert),
    critical: look(INCIDENT_SEVERITY_LABEL.critical, "destructive", ShieldAlert),
  },
  flight: {
    scheduled: look("Scheduled", "info", PlaneTakeoff),
    delayed: look("Delayed", "warning", AlarmClock),
    landed: look("Landed", "success", PlaneLanding),
    cancelled: look("Cancelled", "muted", CircleX),
    diverted: look("Diverted", "warning", Plane),
  },
  invoice: {
    draft: look("Draft", "muted", FilePen),
    issued: look("Issued", "info", FileText),
    paid: look("Paid", "success", CircleCheckBig),
    overdue: look("Overdue", "destructive", CircleAlert),
    void: look("Void", "muted", Ban),
  },
  settlement: {
    draft: look(SETTLEMENT_STATUS_LABEL.draft, "muted", FilePen),
    pending_approval: look(SETTLEMENT_STATUS_LABEL.pending_approval, "warning", ArrowRightLeft),
    approved: look(SETTLEMENT_STATUS_LABEL.approved, "info", BadgeCheck),
    paid: look(SETTLEMENT_STATUS_LABEL.paid, "success", Wallet),
  },
};

/** What a value that is in no table (stale or bad data) looks like: neutral, with its own text. */
export function getStatusLook(domain: StatusDomain, value: string): StatusLook {
  const table = DOMAIN_STATUS[domain] as Record<string, StatusLook>;
  return table[value] ?? look(value || "Unknown", "muted", CircleDashed);
}
