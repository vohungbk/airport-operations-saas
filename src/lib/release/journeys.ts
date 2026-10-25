/**
 * The key journeys of each role, and the tests that check them (VI-F08-S08, spec E3:
 * a fix that breaks a journey that passed is caught by the regression suite before
 * release). The suite is `npm test`, the tests gate of `npm run release:gates`. The
 * journeys are the blocks of tests of the integration suites, which run against the
 * local database; `journeys.test.ts` checks that each block named here is still in its
 * file, so a test that is renamed or removed cannot leave a journey without one.
 */
export type JourneyRole = "admin" | "operations_manager" | "technician" | "partner_user";

export const JOURNEY_ROLES: readonly JourneyRole[] = ["admin", "operations_manager", "technician", "partner_user"];

export interface JourneyTest {
  file: string;
  /** The name of a block of tests in that file, as written in `describe`. */
  block: string;
}

export interface Journey {
  id: string;
  roles: readonly JourneyRole[];
  title: string;
  tests: readonly JourneyTest[];
}

const RLS = "src/lib/auth/rls.integration.test.ts";
const DEMO = "src/lib/demo/demo-role-coverage.integration.test.ts";
const FINANCE_ACCESS = "src/lib/finance/booking-revenue-access.integration.test.ts";
const MANAGERS = ["admin", "operations_manager"] as const;

export const JOURNEYS: readonly Journey[] = [
  { id: "J01", roles: MANAGERS, title: "Create, edit and move bookings through their states", tests: [{ file: RLS, block: "bookings (F11)" }] },
  { id: "J02", roles: MANAGERS, title: "Manage seats and change their status", tests: [{ file: RLS, block: "seats table (F09)" }] },
  {
    id: "J03",
    roles: MANAGERS,
    title: "Manage partners, airports and seat categories",
    tests: [
      { file: RLS, block: "partners table" },
      { file: RLS, block: "airports table" },
      { file: RLS, block: "seat_categories table" },
    ],
  },
  {
    id: "J04",
    roles: MANAGERS,
    title: "Create a job for a booking and follow it to the end",
    tests: [
      { file: RLS, block: "job create access (FO-F01-S04)" },
      { file: RLS, block: "job status update (FO-F01-S05)" },
    ],
  },
  {
    id: "J05",
    roles: MANAGERS,
    title: "Look into incidents and resolve them",
    tests: [
      { file: RLS, block: "update incident status (FO-F05-S06)" },
      { file: RLS, block: "incident access scope (FO-F05-S07)" },
    ],
  },
  { id: "J06", roles: [...MANAGERS, "technician", "partner_user"], title: "See the dashboard figures of what the role may see", tests: [{ file: RLS, block: "dashboard metrics (VI-F01-S01)" }] },
  {
    id: "J07",
    roles: ["technician"],
    title: "See own jobs and open one",
    tests: [
      { file: RLS, block: "job list access (FO-F01-S02)" },
      { file: RLS, block: "job detail access (FO-F01-S03)" },
    ],
  },
  { id: "J08", roles: ["technician"], title: "Start, run and complete an own job", tests: [{ file: RLS, block: "job status update (FO-F01-S05)" }] },
  { id: "J09", roles: ["technician"], title: "Record an installation", tests: [{ file: RLS, block: "record installation (FO-F02-S01)" }] },
  { id: "J10", roles: ["technician"], title: "Clean a seat", tests: [{ file: RLS, block: "start and complete cleaning (FO-F03-S04)" }] },
  { id: "J11", roles: ["technician"], title: "Inspect a seat", tests: [{ file: RLS, block: "record inspection (FO-F04-S01)" }] },
  { id: "J12", roles: ["technician"], title: "Report an incident", tests: [{ file: RLS, block: "report incident (FO-F05-S04)" }] },
  { id: "J13", roles: ["partner_user"], title: "Open the partner home", tests: [{ file: RLS, block: "partner home (VI-F03-S01)" }] },
  { id: "J14", roles: ["partner_user"], title: "List and open the bookings of the own partner", tests: [{ file: RLS, block: "partner bookings (VI-F03-S02)" }] },
  { id: "J15", roles: ["partner_user"], title: "Create and edit a booking of the own partner", tests: [{ file: RLS, block: "partner creates and edits bookings (VI-F03-S03)" }] },
  { id: "J16", roles: ["partner_user"], title: "See the seats on the own bookings", tests: [{ file: RLS, block: "partner seats (VI-F03-S04)" }] },
  {
    id: "J17",
    roles: ["partner_user"],
    title: "Never reach the data of another partner",
    tests: [
      { file: RLS, block: "partner isolation" },
      { file: RLS, block: "partner portal scope (VI-F03-S05)" },
    ],
  },
  { id: "J18", roles: JOURNEY_ROLES, title: "Every demo account signs in and sees its own journey", tests: [{ file: DEMO, block: "demo data covers every role and two partners (VI-F07-S04)" }] },
  { id: "J19", roles: JOURNEY_ROLES, title: "Each role stays inside its own boundaries", tests: [{ file: RLS, block: "role boundaries" }] },
  {
    id: "J20",
    roles: ["admin", "operations_manager", "technician"],
    title: "Scan a seat QR code and clean the seat",
    tests: [
      { file: RLS, block: "QR token lookup (DL-T4)" },
      { file: RLS, block: "QR access protection (CO-F04-S14)" },
      { file: RLS, block: "scan to cleaning chain (DL-T4)" },
    ],
  },
  {
    id: "J22",
    roles: ["admin", "operations_manager"],
    title: "Record a refund, an adjustment or a chargeback on a booking",
    tests: [
      { file: "src/lib/finance/booking-adjustments.integration.test.ts", block: "recording an adjustment (VI-F04-S10, spec R5, R15, R16, R17)" },
      { file: RLS, block: "booking adjustments (VI-F04-S10)" },
      { file: "src/lib/finance/refund-recalculation.integration.test.ts", block: "shares after a refund or a chargeback (VI-F04-S11, spec R15, E6, E7)" },
    ],
  },
  {
    id: "J21",
    roles: ["admin", "operations_manager", "partner_user"],
    title: "See how the revenue of a booking was calculated",
    tests: [
      { file: FINANCE_ACCESS, block: "who can read the revenue of a booking (VI-F04-S08, spec R3)" },
      { file: "src/lib/finance/revenue-share.integration.test.ts", block: "partner and platform shares of a completed rental (VI-F04-S05, spec R11, R17)" },
    ],
  },
];

/** The file has a `describe` (or `describe.skipIf(...)`) with this name; the name in a comment does not count. */
function describes(text: string, block: string): boolean {
  const escaped = block.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`describe(?:\\.skipIf\\([^)]*\\))?\\(\\s*"${escaped}"`).test(text);
}

/** Roles with fewer journeys than this are reported. */
export const MIN_JOURNEYS_PER_ROLE = 3;

/**
 * Pure. What is wrong with the register: a role with too few journeys, a journey with
 * no test, a test file that is gone, a block that is no longer in its file.
 * `read` returns the text of a file, or `null` when it does not exist.
 */
export function findJourneyGaps(
  journeys: readonly Journey[],
  read: (file: string) => string | null,
): string[] {
  const gaps: string[] = [];

  for (const role of JOURNEY_ROLES) {
    const count = journeys.filter((journey) => journey.roles.includes(role)).length;
    if (count < MIN_JOURNEYS_PER_ROLE) {
      gaps.push(`${role}: ${count} journeys, at least ${MIN_JOURNEYS_PER_ROLE} are needed`);
    }
  }

  for (const journey of journeys) {
    if (journey.tests.length === 0) {
      gaps.push(`${journey.id} (${journey.title}): no test checks it`);
    }
    for (const { file, block } of journey.tests) {
      const text = read(file);
      if (text === null) {
        gaps.push(`${journey.id}: ${file} does not exist`);
      } else if (!describes(text, block)) {
        gaps.push(`${journey.id}: "${block}" is no longer in ${file}`);
      }
    }
  }

  return gaps;
}
