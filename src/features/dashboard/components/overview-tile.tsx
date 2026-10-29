import { Card, CardContent } from "@/components/ui/card";

interface OverviewTileProps {
  label: string;
  /** A dash until the formula of the figure is built (another ticket); never a made-up number. */
  value?: number | string;
  /** The small line under the value (the unit and the period of a finance figure). */
  caption?: string;
}

/** A metric tile of the design (UI-F06-S04): the label and the value in 30 px. */
export function OverviewTile({ label, value = "—", caption }: OverviewTileProps) {
  return (
    <Card className="h-full min-h-31">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm break-words text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {caption && <p className="text-xs break-words text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}
