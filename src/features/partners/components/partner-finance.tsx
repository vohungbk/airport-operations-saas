import { LaunchCreditMeter } from "@/components/domain/launch-credit-meter";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OverviewTile } from "@/features/dashboard/components/overview-tile";
import { ScanBanner } from "@/features/installations/components/scan-banner";
import type { PartnerFinanceView } from "@/features/partners/lib/partner-finance";
import { formatAmount } from "@/lib/money/money";

interface PartnerFinanceProps {
  view: PartnerFinanceView;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-base font-semibold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

/**
 * The partner finance screen as the design draws it (VI-F04-S14): four tiles, the launch credit of the
 * Partner Overview, the invoices and statements, and the note about what this workspace holds. Read
 * only: the figures come ready from `buildPartnerFinance`, nothing is calculated here.
 */
export function PartnerFinance({ view }: PartnerFinanceProps) {
  const { launch_credit: launch } = view;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {view.tiles.map((tile) => (
          <OverviewTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            caption={tile.caption}
          />
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <SectionTitle>Launch credit</SectionTitle>
          {launch.target !== null && (
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {formatAmount(launch.accumulated).text}
            </p>
          )}
          <LaunchCreditMeter accumulated={launch.accumulated} target={launch.target} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <SectionTitle>Invoices and statements</SectionTitle>
          {view.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
              <Table stacked>
                <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase">
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="sm:text-right">Total · USD</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="sm:[&_tr]:border-0">
                  {view.invoices.map((invoice) => (
                    <TableRow key={invoice.id} className="sm:h-13">
                      <TableCell data-label="Invoice" className="font-mono text-[13px]">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell data-label="Period">{invoice.period}</TableCell>
                      <TableCell data-label="Issued">{invoice.issued}</TableCell>
                      <TableCell data-label="Total · USD" className="sm:text-right">
                        {invoice.total}
                      </TableCell>
                      <TableCell data-label="Status">
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="size-2 rounded-full bg-foreground" />
                          {invoice.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScanBanner tone="info" title="Your finance records">
        Download invoices and booking-level statements. Contact Operations for billing questions. Internal adjustments and commercial controls are not available in this workspace.
      </ScanBanner>
    </div>
  );
}
