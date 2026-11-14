import { z } from "zod";

import { SETTLEMENT_STATUSES } from "@/features/settlements/schemas/settlement.schema";

export const SETTLEMENTS_PAGE_SIZE = 10;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * What the settlements list reads from the address. A garbled value falls back to "no filter" instead
 * of failing the render. `partner_id` is only a filter: the scope of a partner user is the one RLS
 * gives, never one named in the address.
 */
export const settlementsQuerySchema = z.object({
  partner_id: z.guid().optional().catch(undefined),
  /** The month the settlement covers, `YYYY-MM`. */
  month: month.optional().catch(undefined),
  status: z.enum(SETTLEMENT_STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
});

export type SettlementsQuery = z.infer<typeof settlementsQuerySchema>;

/** The query once the role is known: a partner user has no `partner_id` filter. */
export function resolveSettlementsQuery(query: SettlementsQuery, isPartner: boolean): SettlementsQuery {
  const { partner_id, ...rest } = query;

  return isPartner || !partner_id ? rest : { ...rest, partner_id };
}

export const isSettlementsFiltered = (query: SettlementsQuery): boolean =>
  Boolean(query.partner_id || query.month || query.status);

/** An `/settlements` address that keeps the active filters; `page` is written only when it is not the first. */
export function buildSettlementsHref(query: SettlementsQuery, override: Partial<SettlementsQuery> = {}): string {
  const next = { ...query, ...override };
  const params = new URLSearchParams();

  if (next.partner_id) params.set("partner_id", next.partner_id);
  if (next.month) params.set("month", next.month);
  if (next.status) params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));

  const text = params.toString();

  return text ? `/settlements?${text}` : "/settlements";
}
