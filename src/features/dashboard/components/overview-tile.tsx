import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

interface OverviewTileProps {
  label: string;
  /** A dash until the formula of the figure is built (another ticket); never a made-up number. */
  value?: number | string;
  /** The small line under the value (the unit and the period of a finance figure). */
  caption?: string;
  /** The list the figure counts; the whole tile opens it. */
  href?: string;
}

/** A metric tile of the design (UI-F06-S04): the label and the value in 30 px. */
export function OverviewTile({ label, value = "—", caption, href }: OverviewTileProps) {
  return (
    <Card className="relative h-full min-h-31">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm break-words text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {href ? (
            <Link
              href={href}
              aria-label={`${label}: ${value}`}
              className="after:absolute after:inset-0 after:rounded-xl hover:underline focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {value}
            </Link>
          ) : (
            value
          )}
        </p>
        {caption && <p className="text-xs break-words text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}
