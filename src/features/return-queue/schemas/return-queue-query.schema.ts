import { z } from "zod";

import { RETURN_QUEUE_STEPS } from "@/features/return-queue/lib/return-chain";

export const RETURN_QUEUE_SEARCH_MAX_LENGTH = 100;
const RETURN_QUEUE_DEFAULT_PAGE_SIZE = 20;
const RETURN_QUEUE_MAX_PAGE_SIZE = 100;

/**
 * `searchParams` is user-editable URL state: garbled values fall back to safe
 * defaults via `.catch()` instead of failing the page.
 */
const returnQueueQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .max(RETURN_QUEUE_SEARCH_MAX_LENGTH)
    .optional()
    .catch(undefined),
  step: z.enum(RETURN_QUEUE_STEPS).optional().catch(undefined),
  airport_id: z.guid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  page_size: z.coerce
    .number()
    .int()
    .min(1)
    .max(RETURN_QUEUE_MAX_PAGE_SIZE)
    .catch(RETURN_QUEUE_DEFAULT_PAGE_SIZE),
});

export type ReturnQueueQuery = z.infer<typeof returnQueueQuerySchema>;

export function parseReturnQueueQuery(
  raw: Record<string, string | string[] | undefined>,
): ReturnQueueQuery {
  return returnQueueQuerySchema.parse(raw);
}
