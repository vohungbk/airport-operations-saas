import { z } from "zod";

/** The fields of the board address that a person can set, in the order the filter bar shows them. */
export const WORKFLOW_BOARD_QUERY_FIELDS = [
  "partner_id",
  "airport_id",
  "date",
  "q",
  "flight_alert",
  "priority",
  "booking",
] as const;

export type WorkflowBoardQueryField = (typeof WORKFLOW_BOARD_QUERY_FIELDS)[number];

export const WORKFLOW_BOARD_SEARCH_MAX_LENGTH = 50;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  });

/**
 * The filters of the Workflow Board, read from the address. The same schema runs in the filter bar
 * (before it changes the address) and on the server (when the page reads it), so a value that is not
 * one of the listed options is refused in both places. `booking` is the booking open in the preview.
 */
export const FLIGHT_ALERT_FILTERS = ["early", "delayed"] as const;
export const PRIORITY_FILTERS = ["normal", "high", "urgent"] as const;

export const workflowBoardQuerySchema = z.object({
  partner_id: z.guid().optional(),
  airport_id: z.guid().optional(),
  date: isoDate.optional(),
  q: z.string().trim().min(1).max(WORKFLOW_BOARD_SEARCH_MAX_LENGTH).optional(),
  flight_alert: z.enum(FLIGHT_ALERT_FILTERS).optional(),
  priority: z.enum(PRIORITY_FILTERS).optional(),
  booking: z.guid().optional(),
});

export type WorkflowBoardQuery = z.infer<typeof workflowBoardQuerySchema>;

/** The message shown for a filter that is not valid. */
export const WORKFLOW_BOARD_FILTER_ERRORS: Record<WorkflowBoardQueryField, string> = {
  partner_id: "Choose a partner from the list.",
  airport_id: "Choose an airport from the list.",
  date: "Enter a valid date.",
  q: `Search with 1 to ${WORKFLOW_BOARD_SEARCH_MAX_LENGTH} characters.`,
  flight_alert: "Choose a flight alert from the list.",
  priority: "Choose a priority from the list.",
  booking: "The selected booking is not valid.",
};

export interface ParsedWorkflowBoardQuery {
  query: WorkflowBoardQuery;
  /** One message per field that was not valid. The field is left out of `query`. */
  errors: string[];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  return single === undefined || single.trim() === "" ? undefined : single;
}

/**
 * `searchParams` is address state a person can edit: a field that is not valid is dropped and
 * reported, the rest still apply. Never throws.
 */
export function parseWorkflowBoardQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedWorkflowBoardQuery {
  const query: Record<string, string> = {};
  const errors: string[] = [];

  for (const field of WORKFLOW_BOARD_QUERY_FIELDS) {
    const value = firstValue(raw[field]);

    if (value === undefined) continue;

    const result = workflowBoardQuerySchema.shape[field].safeParse(value);

    if (result.success && result.data !== undefined) {
      query[field] = result.data;
    } else {
      errors.push(WORKFLOW_BOARD_FILTER_ERRORS[field]);
    }
  }

  return { query: query as WorkflowBoardQuery, errors };
}
