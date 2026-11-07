import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BREAKDOWN_HEADINGS,
  ESTIMATE_INTRO,
  TREND_EMPTY,
  TREND_HEADING,
  BREAKDOWN_ROWS,
  ESTIMATE_LINES,
} from "@/features/roi/lib/estimated-value";

interface EstimatedBusinessValueProps {
  /** The verified partner revenue as it is worded, so the trend card names the verified figure next to the estimates. */
  verified_revenue: string;
}

/**
 * The Estimated business value card of the ROI dashboard as the design draws it (VI-F05-S04, R5, R10). It is
 * the frame only: every value is marked Estimate and says Not available until a baseline can be saved
 * (other stories). It never adds an estimate to the verified results.
 */
export function EstimatedBusinessValue({ verified_revenue }: EstimatedBusinessValueProps) {
  return (
    <Card className="min-w-0 flex-1 rounded-lg" aria-labelledby="estimated-value-heading" role="region">
      <CardContent className="flex flex-col gap-4">
        <h2 id="estimated-value-heading" className="text-base font-semibold text-foreground">
          Estimated business value
        </h2>
        <p className="text-sm text-muted-foreground">{ESTIMATE_INTRO}</p>
        <dl className="flex flex-col gap-3 text-sm">
          {ESTIMATE_LINES.map((line) => (
            <div key={line.id} className="flex items-start gap-3">
              <dt className="flex-1 text-muted-foreground">{line.label}</dt>
              <dd className="flex-1 text-right text-foreground">{line.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-4 xl:flex-row">
          <div className="min-w-0 rounded-md border border-border xl:w-[340px] xl:shrink-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {BREAKDOWN_HEADINGS.map((heading) => (
                    <TableHead key={heading} className="text-xs">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {BREAKDOWN_ROWS.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="text-xs">{row.category}</TableCell>
                    <TableCell className="text-xs">{row.baseline}</TableCell>
                    <TableCell className="text-xs">{row.scenario}</TableCell>
                    <TableCell className="text-xs">{row.estimated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-border p-3">
            <h3 className="text-xs font-semibold text-foreground">{TREND_HEADING}</h3>
            <p className="text-xs font-medium text-foreground">Verified partner revenue · {verified_revenue}</p>
            <p className="text-xs text-muted-foreground">{TREND_EMPTY}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
