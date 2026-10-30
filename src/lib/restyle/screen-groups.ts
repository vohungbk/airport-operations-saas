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
      screen("Partners", "/partners", "(admin)/partners/page.tsx", true),
      screen("Partner detail", "/partners/[id]", "(admin)/partners/[id]/page.tsx", true),
      screen("Partner form", "/partners/new", "(admin)/partners/new/page.tsx", true),
      screen("Airports", "/airports", "(admin)/airports/page.tsx", true),
      screen("Airport detail", "/airports/[id]", "(admin)/airports/[id]/page.tsx", true),
      screen("Airport form", "/airports/new", "(admin)/airports/new/page.tsx", true),
      screen("Seat categories", "/seat-categories", "(admin)/seat-categories/page.tsx", true),
      screen("Seat category detail", "/seat-categories/[id]", "(admin)/seat-categories/[id]/page.tsx", true),
      screen("Seat category form", "/seat-categories/new", "(admin)/seat-categories/new/page.tsx", true),
      screen("Seats", "/seats", "(admin)/seats/page.tsx", true),
      screen("Seat form", "/seats/new", "(admin)/seats/new/page.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "No design frame was found for these screens in the readable part of the design file, so they are built from the base components (spec E3). Compare them with the Desktop and Mobile pages of the design file.",
      "The four lists are stacked cards below 640 px (UI-F06-S02). The bookings list is too (UI-F06-S03). The other tables of the app are still tables that scroll sideways until their groups are restyled.",
      "The page padding (p-8) is the same on a phone as on a desktop; a smaller one on a phone is a layout decision for design review.",
    ],
  },
  {
    id: "seat_detail_with_qr",
    name: "Seat detail with QR",
    rule: "R3",
    screens: [screen("Seat detail", "/seats/[id]", "(admin)/seats/[id]/page.tsx", true), screen("Scanned seat", "/q/[token]", "(dashboard)/q/[token]/page.tsx")],
    checks: { same_behavior: "done", both_themes: "pending", phone_layout: "pending", page_states: "pending", design_check: "pending" },
    notes: [
      "The seat detail uses the shared QR card and the status history timeline. It has no photos: the database has only a photo_path text column on installation, cleaning and inspection records, and no storage or upload, so there is nothing to show yet.",
      "The scanned seat page (/q/[token]) is not restyled: it was not looked at as a technician, the role that sees it (an admin is sent to the seat detail).",
    ],
  },
  {
    id: "bookings",
    name: "Bookings",
    rule: "R4",
    screens: [
      screen("Bookings", "/bookings", "(dashboard)/bookings/page.tsx", true),
      screen("Booking detail", "/bookings/[id]", "(dashboard)/bookings/[id]/page.tsx", true),
      screen("Booking form", "/bookings/new", "(dashboard)/bookings/new/page.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "The design file has a frame for the list and for the Flight tab of the booking detail, but none for the booking form (and its edit page), so those are built from the base components (spec E3). Compare them with the design.",
      "The list has the Flight column (the flight number and how early or late it is, from the linked flight). The design has no Airport or Return column and no Category or Seat column; the list keeps Airport and Return (Return sorts) and moves Category and Seat to the detail.",
      "Not built, because nothing stores them: the Workflow step column, the Photos tab, and the flight update history (there is no table of flight changes, only the flight as it is now). The Revenue tab is a button in the header, since the revenue is a page of its own.",
      "The filters are the library controls at 44 px. The design draws the status and airport as buttons with the chevron in front, and one range button for the dates; the app has selects and two date fields. The line under the title shows the airport filter and the number of bookings, not the airport, the date and the time zone of the design. The Edit button has a pencil, not the plus of the design.",
      "The revenue and adjustment pages are not in R4 and are not restyled here.",
    ],
  },
  {
    id: "field_operations",
    name: "Field operations",
    rule: "R5",
    screens: [
      screen("Jobs", "/jobs", "(dashboard)/jobs/page.tsx", true),
      screen("Job detail", "/jobs/[id]", "(dashboard)/jobs/[id]/page.tsx", true),
      screen("Installation", "/jobs/[id]/installation", "(dashboard)/jobs/[id]/installation/page.tsx", true),
      screen("Cleaning", "/jobs/[id]/cleaning", "(dashboard)/jobs/[id]/cleaning/page.tsx", true),
      screen("Inspection", "/jobs/[id]/inspection", "(dashboard)/jobs/[id]/inspection/page.tsx", true),
      screen("Technician queue", "/technician", "(technician)/technician/page.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "The design frames for these screens (Jobs, Job detail, the cleaning states, Inspection record) are text wireframes, not drawn screens, so they set the heading, the actions and the order of the groups; the look comes from the base components and the bookings screens (spec E3). There is no frame for the installation form or the technician queue.",
      "The jobs list keeps its columns (Booking, Technician, Status, Assigned, Vehicle bay). The design wireframe has Job, Booking, Technician, Deadline and Status; a job has no number of its own and no deadline column in the database, so those are not shown. The Deadline filter is not built for the same reason.",
      "The Return queue has a frame in the design (D-38) but no screen in the app, so it is not restyled here; it is a new screen, not a restyle.",
      "The technician queue, which was the placeholder of the project start, is Today's Jobs since UI-F07-S01, built from its own frame of the design: a new screen, not a restyle.",
      "The cleaning states of the design (quarantine, blocked by booking, failed) are not drawn as screens of their own: the app has the start panel, the complete form and the record, and shows the rest as page-state messages.",
    ],
  },
  {
    id: "incidents",
    name: "Incidents",
    rule: "R6",
    screens: [
      screen("Incidents", "/incidents", "(dashboard)/incidents/page.tsx", true),
      screen("Incident detail", "/incidents/[id]", "(dashboard)/incidents/[id]/page.tsx", true),
      screen("Report an incident", "/incidents/new", "(dashboard)/incidents/new/page.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "The incident detail has the Description and Details cards and the status history as a timeline. The design adds a Photo evidence card; the database stores no incident photo, so it is not built (as for the seat detail).",
      "The report form keeps its native selects (job, severity) at 44 px; they are registered with the form, and moving them to the library Select needs a Controller for each field; that is left for later (the two status dialogs already use it).",
    ],
  },
  {
    id: "dashboards",
    name: "Dashboards",
    rule: "R7",
    screens: [
      screen("Command centre", "/dashboard", "(dashboard)/dashboard/page.tsx", true),
      screen("Partner overview", "/partner", "(partner)/partner/page.tsx", true),
      screen("Partner seats", "/partner/seats", "(partner)/partner/seats/page.tsx", true),
      screen("Partner finance", "/partner/finance", "(partner)/partner/finance/page.tsx", true),
      screen("Invoices", "/invoices", "(dashboard)/invoices/page.tsx", true),
      screen("Invoice detail", "/invoices/[id]", "(dashboard)/invoices/[id]/page.tsx", true),
    ],
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: "noted" },
    notes: [
      "The Command Centre and the Partner Overview are the Operations dashboards frame of the design (Dark): the heading, the metric tiles, the flight banners, the status charts side by side (a ring for the seats, bars for bookings and jobs, a stacked bar for the open incidents, the stock by category), the Operational attention table, and for the partner Revenue and invoices, Launch credit and the upcoming rentals. Nothing else is on the pages.",
      "A figure whose formula is not built has a dash and no number, because the formulas are another ticket: the four tiles of the Command Centre, the eight tiles of the Partner Overview, the revenue rows, the launch credit and the next item and status of each queue.",
      "Left out on purpose: the Export report button (there is no export), the line 'installation deadline moved' of the flight banners (no deadline is stored), and the flight number and the booking under a banner (the alert part has no line for them). The banners show an early and a late flight from the flights table.",
      "The charts of the Command Centre are the chart components (ring, bars, stacked bar), so they take the frame, legend and table switch of the components; the ring and the stacked bar use the solid mode (a solid color and a symbol before each legend name, as the design frame has), the ring says 'Total' in its middle where the design says 'seats', and an empty chart says 'No data to chart yet.' in place of a message for each chart. A chart that could not be read or has nothing to count shows the error with a retry or the empty state of the frame.",
      "The count cards of the earlier dashboard, with their links to the lists, and the partner home cards (Bookings, Seats, Finance) are no longer on these pages, because the design does not have them. Their components (MetricTile, DashboardMetricsGrid, DashboardFigures, PartnerHomeNav, DashboardChart, DashboardRetryButton) and tests are still in the code, unused; removing them is a decision for the team.",
    ],
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
