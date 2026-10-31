"use client";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { GenerateInvoiceCreated } from "@/features/invoices/components/generate-invoice-created";
import { InvoicePeriodsList } from "@/features/invoices/components/invoice-periods-list";
import { useGenerateInvoiceForm } from "@/features/invoices/hooks/use-generate-invoice-form";
import { plainAmount } from "@/features/invoices/lib/invoice-detail";
import { formatInvoiceAmount } from "@/features/invoices/lib/invoice-list";
import type { SettlementPeriodRow } from "@/features/invoices/lib/invoice-periods";
import type { SettlementPartnerOption } from "@/features/settlements/lib/get-settlement-partners";

interface GenerateInvoiceFormProps {
  partners: SettlementPartnerOption[];
  periods: SettlementPeriodRow[];
}

/**
 * The Generate invoice card of the design (VI-F09-S06): a partner and a month with an approved settlement, what the
 * invoice will be worth, and Generate draft. It makes a draft only; issuing it is another story. Presentation only:
 * the rules are in the schema, the Server Action and the database function.
 */
export function GenerateInvoiceForm({ partners, periods }: GenerateInvoiceFormProps) {
  const {
    partnerId,
    month,
    subject,
    options,
    selected,
    notice,
    created,
    isPending,
    canSubmit,
    selectPartner,
    selectMonth,
    onSubmit,
  } = useGenerateInvoiceForm(partners, periods);

  return (
    <Card className="max-w-xl">
      <CardContent className="flex flex-col gap-5">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Generate invoice</h2>

        {created ? (
          <GenerateInvoiceCreated invoice={created} subject={subject} />
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="partner_id">Partner</FieldLabel>
              <Select value={partnerId ?? ""} onValueChange={selectPartner} disabled={isPending}>
                <SelectTrigger id="partner_id" className="w-full">
                  <SelectValue placeholder="Choose a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.value} value={partner.value}>
                      {partner.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="month">Period</FieldLabel>
              <Select value={month ?? ""} onValueChange={selectMonth} disabled={isPending || options.length === 0}>
                <SelectTrigger id="month" className="w-full">
                  <SelectValue placeholder="Select a period" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.month} value={option.month} disabled={!option.selectable}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Only months with an approved settlement are selectable.</p>
            </Field>

            {options.length > 0 && (
              <InvoicePeriodsList options={options} month={month} disabled={isPending} onSelect={selectMonth} />
            )}

            {selected && (
              <div className="max-w-xs">
                <OverviewTile
                  label="Settlement amount / read only"
                  value={formatInvoiceAmount(selected.amounts.total)}
                  caption={`Subtotal ${plainAmount(selected.amounts.subtotal)} + VAT ${plainAmount(selected.amounts.vat)}`}
                />
              </div>
            )}

            <Alert variant={notice.kind === "info" ? "default" : "destructive"}>
              <AlertTitle>{notice.title}</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                {notice.message}
                {notice.kind === "duplicate" && notice.invoice_id && (
                  <Link href={`/invoices/${notice.invoice_id}`} className="font-medium underline underline-offset-4">
                    View invoice
                  </Link>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="min-h-11 px-4" disabled={!canSubmit}>
                {isPending ? "Generating..." : notice.kind === "server_error" ? "Retry" : "Generate draft"}
              </Button>
              <Link href="/invoices" className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
                Cancel
              </Link>
            </div>

            {notice.kind === "not_approved" && notice.note && (
              <p className="text-sm font-semibold text-danger-fg">{notice.note}</p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
