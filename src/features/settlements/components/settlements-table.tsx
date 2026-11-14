import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SettlementRow } from "@/features/settlements/lib/get-settlements";
import { formatSettlementAmount, settlementPeriodLabel } from "@/features/settlements/lib/settlement";

interface SettlementsTableProps {
  settlements: SettlementRow[];
}

const AMOUNT_COLUMNS = [
  { label: "Gross revenue", value: (row: SettlementRow) => row.gross_revenue },
  { label: "Partner share", value: (row: SettlementRow) => row.partner_share },
  { label: "Platform share", value: (row: SettlementRow) => row.platform_share },
  { label: "Adjustments", value: (row: SettlementRow) => row.adjustments },
] as const;

const NUMBER_CLASS = "font-mono text-[13px] tabular-nums sm:text-right";

/**
 * The register of the Settlements list, newest month first, read only. The figures are the ones of the
 * design: the gross revenue is already net of refunds and chargebacks, so only the adjustments are
 * shown next to the shares; the amount is what the partner is paid. A row opens nothing yet (the
 * breakdown is a later screen, where the buttons that move a status will be), so the chevron is only a hint.
 */
export function SettlementsTable({ settlements }: SettlementsTableProps) {
  return (
    <Table stacked>
      <TableHeader className="[&_th]:h-12 [&_th]:text-[11px] [&_th]:font-medium [&_th]:text-muted-foreground">
        <TableRow>
          <TableHead>Settlement</TableHead>
          <TableHead>Partner</TableHead>
          <TableHead>Period</TableHead>
          {AMOUNT_COLUMNS.map((column) => (
            <TableHead key={column.label} className="sm:text-right">
              {column.label}
            </TableHead>
          ))}
          <TableHead className="sm:text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-8">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="sm:[&_tr]:h-16">
        {settlements.map((settlement) => (
          <TableRow key={settlement.id}>
            <TableCell data-label="Settlement" className="font-mono text-[13px] text-primary">
              {settlement.settlement_number}
            </TableCell>
            <TableCell data-label="Partner">{settlement.partner?.name ?? "-"}</TableCell>
            <TableCell data-label="Period">{settlementPeriodLabel(settlement.period_start)}</TableCell>
            {AMOUNT_COLUMNS.map((column) => (
              <TableCell key={column.label} data-label={column.label} className={NUMBER_CLASS}>
                {formatSettlementAmount(column.value(settlement))}
              </TableCell>
            ))}
            <TableCell data-label="Amount" className={`${NUMBER_CLASS} font-semibold`}>
              {formatSettlementAmount(settlement.final_amount)}
            </TableCell>
            <TableCell data-label="Status">
              <StatusBadge domain="settlement" value={settlement.status} />
            </TableCell>
            <TableCell aria-hidden="true" className="text-muted-foreground max-sm:hidden">
              <ChevronRight className="size-4" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
