import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/features/bookings/lib/booking-revenue";
import type { SettlementRow } from "@/features/settlements/lib/get-settlements";
import { SETTLEMENT_STATUS_LABEL, settlementMonth } from "@/features/settlements/lib/settlement";

interface SettlementsTableProps {
  settlements: SettlementRow[];
}

const COLUMNS = [
  "Month",
  "Partner",
  "Gross revenue",
  "Partner share",
  "Platform share",
  "Refunds",
  "Adjustments",
  "Chargebacks",
  "Credits",
  "Fees",
  "Final amount",
  "Status",
] as const;

/**
 * VI-F04 S4 (R6): the settlements in scope, newest month first, read only; the page says what it shows when there is none. Refunds, adjustments and
 * chargebacks are shown, not taken off again: the gross revenue is already net of them.
 */
export function SettlementsTable({ settlements }: SettlementsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {settlements.map((settlement) => (
          <TableRow key={settlement.id}>
            <TableCell>{settlementMonth(settlement.period_start)}</TableCell>
            <TableCell>
              {settlement.partner ? `${settlement.partner.name} (${settlement.partner.code})` : "-"}
            </TableCell>
            <TableCell>{formatMoney(settlement.gross_revenue)}</TableCell>
            <TableCell>{formatMoney(settlement.partner_share)}</TableCell>
            <TableCell>{formatMoney(settlement.platform_share)}</TableCell>
            <TableCell>{formatMoney(settlement.refunds)}</TableCell>
            <TableCell>{formatMoney(settlement.adjustments)}</TableCell>
            <TableCell>{formatMoney(settlement.chargebacks)}</TableCell>
            <TableCell>{formatMoney(settlement.launch_credit)}</TableCell>
            <TableCell>{formatMoney(settlement.fees)}</TableCell>
            <TableCell>{formatMoney(settlement.final_amount)}</TableCell>
            <TableCell>{SETTLEMENT_STATUS_LABEL[settlement.status]}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
