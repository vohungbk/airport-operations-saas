"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";

import { runClientAction } from "@/lib/actions/run-client-action";
import { zodResolver } from "@/lib/validation/zod-resolver";
import { generateInvoiceAction } from "@/features/invoices/actions/generate-invoice.action";
import { buildInvoiceNotice } from "@/features/invoices/lib/generate-invoice-notice";
import { NETWORK_ERROR, type GenerateInvoiceResult } from "@/features/invoices/lib/invoice-errors";
import { buildPeriodOptions, type SettlementPeriodRow } from "@/features/invoices/lib/invoice-periods";
import { generateInvoiceSchema, type GenerateInvoiceInput } from "@/features/invoices/schemas/generate-invoice.schema";
import type { SettlementPartnerOption } from "@/features/settlements/lib/get-settlement-partners";

/**
 * The state of the Generate invoice form (VI-F09-S06): the months of the chosen partner, the month chosen, what the
 * box under the amount says, and the answer of the server. The screen only draws it.
 */
export function useGenerateInvoiceForm(
  partners: readonly SettlementPartnerOption[],
  periods: readonly SettlementPeriodRow[],
) {
  const form = useForm<GenerateInvoiceInput>({
    resolver: zodResolver(generateInvoiceSchema),
    defaultValues: { partner_id: undefined, month: "" },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerateInvoiceResult | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const partnerId = useWatch({ control: form.control, name: "partner_id" });
  const month = useWatch({ control: form.control, name: "month" });

  const options = useMemo(() => (partnerId ? buildPeriodOptions(periods, partnerId) : []), [periods, partnerId]);
  const selected = options.find((option) => option.selectable && option.month === month) ?? null;
  const error = result && !result.success ? result.error : null;
  const notice = buildInvoiceNotice({ validation, error, selected });
  const created = result?.success ? result.invoice : null;
  /** `Emirates Rent A Car / September 2026`: who the new draft is for and which month. */
  const partnerName = partners.find((partner) => partner.value === partnerId)?.label.replace(/ \([^)]*\)$/, "") ?? "";
  const subject = `${partnerName} / ${options.find((option) => option.month === month)?.label ?? ""}`;

  const forget = () => {
    setResult(null);
    setValidation(null);
  };

  const selectPartner = (id: string | null) => {
    if (id) {
      form.setValue("partner_id", id);
      form.setValue("month", "");
      forget();
    }
  };

  const selectMonth = (value: string | null) => {
    if (value) {
      form.setValue("month", value);
      forget();
    }
  };

  const onSubmit = form.handleSubmit(
    (values) => {
      forget();
      startTransition(async () => {
        setResult(await runClientAction(() => generateInvoiceAction(values), NETWORK_ERROR));
      });
    },
    (errors) => setValidation(Object.values(errors)[0]?.message ?? null),
  );

  return {
    partnerId,
    month,
    subject,
    options,
    selected,
    notice,
    created,
    isPending,
    /** A month that already has its invoice cannot be generated again. */
    canSubmit: !isPending && notice.kind !== "duplicate",
    selectPartner,
    selectMonth,
    onSubmit,
  };
}
