import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** What the screen writes where a figure has no source yet (the job number, the deadline, the partner). */
export const NONE = "—";

/** `Terminal 3` for a terminal stored as a number, the stored text for any other. */
export function terminalLabel(terminal: string): string {
  return /^\d+$/.test(terminal) ? `Terminal ${terminal}` : terminal;
}

interface KeyValueProps {
  label: string;
  children: ReactNode;
  /** The value is a code (a booking, a seat): set in the mono face of the design. */
  mono?: boolean;
}

/** A label at the left and its value at the right, each taking half of the row (the key value of the design). */
export function KeyValue({ label, children, mono = false }: KeyValueProps) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <p className="min-w-0 flex-1 text-muted-foreground">{label}</p>
      <p
        className={cn(
          "min-w-0 flex-1 text-right break-words text-foreground",
          mono && "font-mono",
        )}
      >
        {children}
      </p>
    </div>
  );
}

interface SectionCardProps {
  title: string;
  children: ReactNode;
}

/** A card of the design: a heading of 16 px and its content, 20 px inside, 16 px between. */
export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}
