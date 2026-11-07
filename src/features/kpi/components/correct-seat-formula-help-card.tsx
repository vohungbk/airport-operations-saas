import { Card, CardContent } from "@/components/ui/card";
import type { CorrectSeatFormulaHelp } from "@/features/kpi/lib/correct-seat-formula-help";

interface CorrectSeatFormulaHelpCardProps {
  help: CorrectSeatFormulaHelp;
}

/** The formula of Correct-seat fulfilment, and its two numbers for the period, as the design draws it. */
export function CorrectSeatFormulaHelpCard({ help }: CorrectSeatFormulaHelpCardProps) {
  return (
    <Card aria-labelledby="formula-help-heading" role="region" className="rounded-lg [--card-spacing:--spacing(5)]">
      <CardContent className="flex flex-col gap-4">
        <h2 id="formula-help-heading" className="text-base font-semibold text-foreground">
          {help.title}
        </h2>
        <p className="text-sm text-foreground">{help.formula}</p>
        <dl className="flex items-start gap-3 text-sm">
          <dt className="flex-1 text-muted-foreground">{help.row_label}</dt>
          <dd className="flex-1 text-right text-foreground">{help.row_value}</dd>
        </dl>
        <p className="text-sm text-muted-foreground">{help.note}</p>
      </CardContent>
    </Card>
  );
}
