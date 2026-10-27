/**
 * The screen groups to restyle, in the order they are restyled, and the check each one passes
 * (UI-F06-S01, spec §4.2, R1 to R7, R8 to R13). It is data: the app does not show it, and a test keeps
 * it true (every file exists, the order is the planned one, a group is done only when all its screens are).
 * Update it in the story that restyles a group.
 */

export type RestyleCheckId = "same_behavior" | "both_themes" | "phone_layout" | "page_states" | "design_check";

export interface RestyleCheck {
  id: RestyleCheckId;
  rule: string;
  /** What is checked, in words. */
  description: string;
}

/** The checks every group passes (R8, R9, R10, R11, R13). The order of work is R12, kept by the order of the groups. */
export const RESTYLE_CHECKS: readonly RestyleCheck[] = [
  { id: "same_behavior", rule: "R8", description: "Data, actions, permissions and addresses are as before; the existing tests pass" },
  { id: "both_themes", rule: "R9", description: "Looked at in Light and in Dark; no raw colors" },
  { id: "phone_layout", rule: "R10", description: "Looked at at 390 px: tables become stacked cards, nothing under the bottom navigation, touch targets of 44 px" },
  { id: "page_states", rule: "R11", description: "Loading, empty, error, forbidden and not-found use the state components" },
  { id: "design_check", rule: "R13", description: "Compared with the design frame; every difference is fixed or noted" },
];

/**
 * `done`: passed. `noted`: there is a difference or no design frame to compare with, and it is written down
 * for design review (R13, E3). `pending`: not checked yet.
 */
export type RestyleCheckStatus = "done" | "noted" | "pending";

export interface RestyleScreen {
  name: string;
  /** The address the screen is opened at; `null` for a screen with no address of its own (a boundary). */
  route: string | null;
  /** The page or layout file, relative to `src/app`. */
  file: string;
  restyled: boolean;
}

export interface RestyleGroup {
  id: string;
  name: string;
  /** The rule of the spec that names the group. */
  rule: string;
  screens: readonly RestyleScreen[];
  checks: Readonly<Record<RestyleCheckId, RestyleCheckStatus>>;
  /** What is noted for design review, when a check is `noted`. */
  notes?: readonly string[];
}

const pending: RestyleGroup["checks"] = {
  same_behavior: "pending",
  both_themes: "pending",
  phone_layout: "pending",
  page_states: "pending",
  design_check: "pending",
};

const screen = (name: string, route: string | null, file: string, restyled = false): RestyleScreen => ({ name, route, file, restyled });

/** In the order of R12: sign-in and system pages, reference data, bookings, field operations, incidents, dashboards. */
export const RESTYLE_GROUPS: readonly RestyleGroup[] = [
  {
    id: "sign_in_and_system",
    name: "Sign-in and system pages",
    rule: "R1",
    screens: [
      screen("Sign in", "/login", "(auth)/login/page.tsx", true),
      screen("Sign up", "/signup", "(auth)/signup/page.tsx", true),
      screen("Forgot password", "/forgot-password", "(auth)/forgot-password/page.tsx", true),
      screen("Reset password", "/reset-password", "(auth)/reset-password/page.tsx", true),
      screen("Forbidden", "/forbidden", "forbidden/page.tsx", true),
      screen("No partner", "/forbidden?reason=no_partner", "forbidden/page.tsx", true),
      screen("Not found", null, "not-found.tsx", true),
      screen("Error", null, "error.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "No design frame for these pages was found in the readable part of the design file, so they are built from the base components (spec E3). Compare them with the Desktop and Mobile pages of the design file.",
      "The home page (/) is still the placeholder of the project start; it is not in R1.",
    ],
  },
  {
    id: "reference_data",
    name: "Reference data",
    rule: "R2",
    screens: [
      screen("Partners", "/partners", "(admin)/partners/page.tsx"),
      screen("Partner detail", "/partners/[id]", "(admin)/partners/[id]/page.tsx"),
      screen("Partner form", "/partners/new", "(admin)/partners/new/page.tsx"),
      screen("Airports", "/airports", "(admin)/airports/page.tsx"),
      screen("Airport detail", "/airports/[id]", "(admin)/airports/[id]/page.tsx"),
      screen("Airport form", "/airports/new", "(admin)/airports/new/page.tsx"),
      screen("Seat categories", "/seat-categories", "(admin)/seat-categories/page.tsx"),
      screen("Seat category detail", "/seat-categories/[id]", "(admin)/seat-categories/[id]/page.tsx"),
      screen("Seat category form", "/seat-categories/new", "(admin)/seat-categories/new/page.tsx"),
      screen("Seats", "/seats", "(admin)/seats/page.tsx"),
      screen("Seat form", "/seats/new", "(admin)/seats/new/page.tsx"),
    ],
    checks: pending,
  },
  {
    id: "seat_detail_with_qr",
    name: "Seat detail with QR",
    rule: "R3",
    screens: [screen("Seat detail", "/seats/[id]", "(admin)/seats/[id]/page.tsx"), screen("Scanned seat", "/q/[token]", "(dashboard)/q/[token]/page.tsx")],
    checks: pending,
  },
  {
    id: "bookings",
    name: "Bookings",
    rule: "R4",
    screens: [
      screen("Bookings", "/bookings", "(dashboard)/bookings/page.tsx"),
      screen("Booking detail", "/bookings/[id]", "(dashboard)/bookings/[id]/page.tsx"),
      screen("Booking form", "/bookings/new", "(dashboard)/bookings/new/page.tsx"),
    ],
    checks: pending,
  },
  {
    id: "field_operations",
    name: "Field operations",
    rule: "R5",
    screens: [
      screen("Jobs", "/jobs", "(dashboard)/jobs/page.tsx"),
      screen("Job detail", "/jobs/[id]", "(dashboard)/jobs/[id]/page.tsx"),
      screen("Installation", "/jobs/[id]/installation", "(dashboard)/jobs/[id]/installation/page.tsx"),
      screen("Cleaning", "/jobs/[id]/cleaning", "(dashboard)/jobs/[id]/cleaning/page.tsx"),
      screen("Inspection", "/jobs/[id]/inspection", "(dashboard)/jobs/[id]/inspection/page.tsx"),
      screen("Technician queue", "/technician", "(technician)/technician/page.tsx"),
    ],
    checks: pending,
  },
  {
    id: "incidents",
    name: "Incidents",
    rule: "R6",
    screens: [
      screen("Incidents", "/incidents", "(dashboard)/incidents/page.tsx"),
      screen("Incident detail", "/incidents/[id]", "(dashboard)/incidents/[id]/page.tsx"),
      screen("Report an incident", "/incidents/new", "(dashboard)/incidents/new/page.tsx"),
    ],
    checks: pending,
  },
  {
    id: "dashboards",
    name: "Dashboards",
    rule: "R7",
    screens: [
      screen("Command centre", "/dashboard", "(dashboard)/dashboard/page.tsx"),
      screen("Partner overview", "/partner", "(partner)/partner/page.tsx"),
      screen("Partner seats", "/partner/seats", "(partner)/partner/seats/page.tsx"),
    ],
    checks: pending,
  },
];

const CHECK_IDS = RESTYLE_CHECKS.map((check) => check.id);

/**
 * A group is done only when every one of its screens is restyled and every check is done or noted: a group
 * with part of its screens restyled is not marked done (spec E4).
 */
export function isGroupDone(group: RestyleGroup): boolean {
  return group.screens.every((s) => s.restyled) && CHECK_IDS.every((id) => group.checks[id] !== "pending");
}

export const restyledScreens = (group: RestyleGroup): number => group.screens.filter((s) => s.restyled).length;
