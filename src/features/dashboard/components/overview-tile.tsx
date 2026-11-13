import type { ReactNode } from "react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { UNAVAILABLE_TEXT } from "@/features/dashboard/lib/failed-queues";
import { cn } from "@/lib/utils";

interface OverviewTileProps {
  label: string;
  /** A dash until the formula of the figure is built (another ticket); never a made-up number. */
  value?: number | string;
  /** The small line under the value (the unit and the period of a finance figure). */
  caption?: string;
  /** The figure could not be read: the tile says so instead of a value (VI-F11-S13), and does not open its list. */
  unavailable?: boolean;
  /** The list the figure counts; the whole tile opens it. */
  href?: string;
  /** Extra classes for the card, for a screen whose design draws the tile a little differently. */
  className?: string;
  /** Something that sits over the whole tile, such as the button of a popover (VI-F05-S03). */
  overlay?: ReactNode;
}

/** A metric tile of the design (UI-F06-S04): the label and the value in 30 px. */
export function OverviewTile({ label, value = "—", caption, unavailable = false, href, className, overlay }: OverviewTileProps) {
  return (
    <Card className={cn("relative h-full min-h-31", className)}>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm break-words text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-semibold tracking-tight text-foreground",
            unavailable ? "text-lg font-medium text-muted-foreground" : "text-3xl",
          )}
        >
          {unavailable ? (
            UNAVAILABLE_TEXT
          ) : href ? (
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
      {overlay}
    </Card>
  );
}
