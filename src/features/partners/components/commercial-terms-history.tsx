import { Check } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TermsHistoryRow } from "@/features/partners/lib/commercial-terms";

interface CommercialTermsHistoryProps {
  rows: TermsHistoryRow[];
  /** `v3`, shown under the table; null when the partner has no terms. */
  currentLabel: string | null;
  /** Older versions were cut off by the limit. */
  truncated: boolean;
  limit: number;
}

/**
 * VI-F04 R2: the "Terms history" card of the design, read only. Every version is kept as it was, so
 * what a completed rental was calculated with can still be explained.
 */
export function CommercialTermsHistory({ rows, currentLabel, truncated, limit }: CommercialTermsHistoryProps) {
  return (
    <section aria-labelledby="terms-history-heading" className="flex flex-col gap-3 rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h2 id="terms-history-heading" className="text-sm font-semibold text-foreground">
          Terms history
        </h2>
        <p className="text-xs text-muted-foreground">Read only · Earlier versions are retained</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No terms yet. Every saved version is listed here.</p>
      ) : (
        <Table>
          <TableHeader className="[&_th]:h-10 [&_th]:text-[11px] [&_th]:font-medium [&_th]:text-muted-foreground">
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Effective date</TableHead>
              <TableHead>Partner share</TableHead>
              <TableHead>Launch share</TableHead>
              <TableHead>Changed by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-xs">
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {row.is_current && <Check aria-label="Current terms" className="size-3 text-success-fg" />}
                  </span>
                </TableCell>
                <TableCell>{row.effective_date}</TableCell>
                <TableCell>{row.partner_share}</TableCell>
                <TableCell>{row.launch_share}</TableCell>
                <TableCell>{row.changed_by}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {currentLabel && (
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
          Current terms · {currentLabel.toUpperCase()}
        </p>
      )}
      {truncated && <p className="text-xs text-muted-foreground">Only the latest {limit} versions are shown.</p>}
    </section>
  );
}
