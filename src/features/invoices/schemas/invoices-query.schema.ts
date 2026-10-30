import { z } from "zod";

import { INVOICE_STATUSES, visibleInvoiceStatuses } from "@/features/invoices/lib/invoice-list";

/**
 * Explicit column allowlist for the `sort` query param of `/invoices`, never a raw `searchParams` value in
 * `.order()`. `period` sorts by the issue date: an invoice has no period column of its own, and it is issued
 * in the month after the one it covers.
 */
export const INVOICES_SORT_COLUMNS = ["invoice_number", "period", "amount", "due_date"] as const;

export type InvoicesSortColumn = (typeof INVOICES_SORT_COLUMNS)[number];

export const INVOICES_DEFAULT_SORT: InvoicesSortColumn = "due_date";
const INVOICES_DEFAULT_ORDER = "desc";
export const INVOICES_DEFAULT_PAGE = 1;
export const INVOICES_PAGE_SIZES = [10, 25, 50] as const;
/** The page sizes of the design: 10 for a partner, 25 for the operations team. */
export const INVOICES_PARTNER_PAGE_SIZE = 10;
export const INVOICES_INTERNAL_PAGE_SIZE = 25;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * What the invoice list reads from the address (VI-F09-S01). Garbled values fall back to safe defaults instead
 * of failing the render. `partner_id` is read here but only an operations user may use it: the page drops it
 * for a partner user, whose scope is the one RLS gives and never one named in the address. `page_size` is not
 * defaulted here, because the default depends on the role.
 */
export const invoicesQuerySchema = z.object({
  q: z.string().trim().min(1).max(40).optional().catch(undefined),
  status: z.enum(INVOICE_STATUSES).optional().catch(undefined),
  from: month.optional().catch(undefined),
  to: month.optional().catch(undefined),
  partner_id: z.guid().optional().catch(undefined),
  sort: z.enum(INVOICES_SORT_COLUMNS).catch(INVOICES_DEFAULT_SORT),
  order: z.enum(["asc", "desc"]).catch(INVOICES_DEFAULT_ORDER),
  page: z.coerce.number().int().min(1).catch(INVOICES_DEFAULT_PAGE),
  page_size: z.coerce
    .number()
    .int()
    .refine((value): value is (typeof INVOICES_PAGE_SIZES)[number] =>
      (INVOICES_PAGE_SIZES as readonly number[]).includes(value),
    )
    .optional()
    .catch(undefined),
});

export type InvoicesQuery = z.infer<typeof invoicesQuerySchema>;

/** The query once the role is known: the page size is set and a partner has no `partner_id`. */
export interface ResolvedInvoicesQuery extends Omit<InvoicesQuery, "page_size"> {
  page_size: number;
}

export function resolveInvoicesQuery(query: InvoicesQuery, isPartner: boolean): ResolvedInvoicesQuery {
  const { partner_id, page_size, status, ...rest } = query;
  const visible = visibleInvoiceStatuses(isPartner);

  return {
    ...rest,
    // A status the role may not see is dropped, as if it had not been asked for.
    ...(status && visible.includes(status) ? { status } : {}),
    ...(isPartner || !partner_id ? {} : { partner_id }),
    page_size: page_size ?? (isPartner ? INVOICES_PARTNER_PAGE_SIZE : INVOICES_INTERNAL_PAGE_SIZE),
  };
}
