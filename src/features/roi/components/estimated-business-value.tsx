import type { CSSProperties } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BREAKDOWN_HEADINGS,
  ESTIMATE_INTRO,
  TREND_HEADING,
  type EstimateView,
} from "@/features/roi/lib/estimated-value";
import { cn } from "@/lib/utils";

interface EstimatedBusinessValueProps {
  view: EstimateView;
}

/**
 * The Estimated business value card of the ROI dashboard as the design draws it (VI-F05-S06, R5, R10): the
 * estimated lines, the breakdown table and the value bars. Every value is marked Estimate, and it never adds
 * an estimate to the verified results. It only draws what the view gives it.
 */
export function EstimatedBusinessValue({ view }: EstimatedBusinessValueProps) {
  return (
    <Card className="min-w-0 flex-1 rounded-lg" aria-labelledby="estimated-value-heading" role="region">
      <CardContent className="flex flex-col gap-4">
        <h2 id="estimated-value-heading" className="text-base font-semibold text-foreground">
          Estimated business value
        </h2>
        <p className="text-sm text-muted-foreground">{ESTIMATE_INTRO}</p>
        <dl className="flex flex-col gap-3 text-sm">
          {view.lines.map((line) => (
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
                {view.breakdown.map((row) => (
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
            {view.series.map((series) => (
              <div key={series.id} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-foreground">{series.label}</p>
                <div className="h-1 w-full overflow-hidden bg-muted">
                  <div
                    aria-hidden="true"
                    className={cn("h-1 w-(--bar-share)", series.tone === "primary" ? "bg-primary" : "bg-secondary")}
                    style={{ "--bar-share": `${series.share}%` } as CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
