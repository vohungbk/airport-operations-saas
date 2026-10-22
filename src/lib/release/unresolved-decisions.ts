import { z } from "zod";

/**
 * The decisions that are not made yet and that a release depends on (VI-F08-S08,
 * spec R8). The release readiness report lists them, so the people who decide can
 * see them in one place. A decision is closed here only with who decided, when
 * and what: a closed one with a field missing stays open in the report.
 *
 * Every entry comes from a spec or a doc of the repo; add one only with its source.
 */
const open = z.object({
  id: z.string().trim().min(1),
  /** Where the question is written down. */
  source: z.string().trim().min(1),
  question: z.string().trim().min(1),
  /** What it means for the release while it is open. */
  effect: z.string().trim().min(1),
  status: z.literal("open"),
});

const decided = open.extend({
  status: z.literal("decided"),
  decision: z.string().trim().min(1),
  decided_by: z.string().trim().min(1),
  /** `YYYY-MM-DD`. */
  decided_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
});

export const decisionSchema = z.discriminatedUnion("status", [open, decided]);

export type Decision = z.infer<typeof decisionSchema>;

const VI_F08 = "VI-F08 spec (qa-accessibility-performance.md) §12";
const VI_F07 = "VI-F07 spec (demo-data-readiness.md) §12";

export const DECISIONS: readonly Decision[] = [
  {
    id: "VI-F08-Q1",
    source: VI_F08,
    question: "What WCAG level is the target?",
    effect: "No level is claimed. Accessibility is checked in part (docs/accessibility-review.md).",
    status: "open",
  },
  {
    id: "VI-F08-Q2",
    source: VI_F08,
    question: "What response-time targets and test load should be used?",
    effect: "No target is claimed. Performance is measured and reported only (docs/performance.md).",
    status: "open",
  },
  {
    id: "VI-F08-Q3",
    source: VI_F08,
    question: "What browsers and devices must be supported?",
    effect: "No list of devices is claimed. The layouts were checked in one browser (docs/responsive-review.md).",
    status: "open",
  },
  {
    id: "VI-F08-Q4",
    source: VI_F08,
    question: "Who signs off release readiness?",
    effect: "This report lists facts and records no sign-off.",
    status: "open",
  },
  {
    id: "VI-F07-Q1",
    source: VI_F07,
    question: "Is the first target a production release or a portfolio demonstration?",
    effect: "It decides whether the demo data and the demo guard are the release data.",
    status: "open",
  },
  {
    id: "VI-F07-Q2",
    source: VI_F07,
    question: "How many partners, airports, seats, and bookings should the demo set contain?",
    effect: "The demo set is two partners, one airport, 40 seats and 30 bookings, as built.",
    status: "open",
  },
  {
    id: "VI-F07-Q3",
    source: VI_F07,
    question: "Which environments may receive demo data, and who may reset them?",
    effect: "Demo data loads only into a local database; the scripts and seeds refuse anything else.",
    status: "open",
  },
  {
    id: "SPEC-VI-F07-CONFIRMATION",
    source: "VI-F07 spec §0 (revision log)",
    question: "Has the spec of VI-F07 been confirmed? No sign-off is recorded in its revision log.",
    effect: "The spec is built as written; the parts that depend on the open questions are marked.",
    status: "open",
  },
  {
    id: "SPEC-VI-F08-CONFIRMATION",
    source: "VI-F08 spec §0 (revision log)",
    question: "Has the spec of VI-F08 been confirmed? No sign-off is recorded in its revision log.",
    effect: "The spec is built as written; the parts that depend on the open questions are marked.",
    status: "open",
  },
  {
    id: "VI-F04-FINANCE",
    source: "docs/security.md, Partner finance (VI-F03-S06)",
    question: "Finance (settlements, invoices, commercial terms) has no spec or code: when is it released?",
    effect: "Partner finance is shown as not available yet, and the dashboard has no finance figure.",
    status: "open",
  },
];

export interface DecisionCheck {
  /** Entries that are not complete or are not valid. */
  rejected: { id: string; issues: string[] }[];
  /** Entries that are valid: those still open, and those closed with who, when and what. */
  decisions: Decision[];
}

/** Pure. A closed decision with a field missing is not closed: it is reported and left out. */
export function checkDecisions(candidates: readonly unknown[]): DecisionCheck {
  const decisions: Decision[] = [];
  const rejected: DecisionCheck["rejected"] = [];

  candidates.forEach((candidate, index) => {
    const result = decisionSchema.safeParse(candidate);
    if (result.success) {
      decisions.push(result.data);
    } else {
      const id = (candidate as { id?: unknown } | null)?.id;
      rejected.push({
        id: typeof id === "string" ? id : `entry ${index + 1}`,
        issues: result.error.issues.map((issue) => `${issue.path.join(".") || "entry"}: ${issue.message}`),
      });
    }
  });

  return { decisions, rejected };
}
