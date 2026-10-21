import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { PartnerHomeItem } from "@/features/partners/lib/partner-home-items";

interface PartnerHomeNavProps {
  items: readonly PartnerHomeItem[];
}

/** One card per view; a view that is not released says so and has no link. */
export function PartnerHomeNav({ items }: PartnerHomeNavProps) {
  return (
    <nav aria-label="Partner views" className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const body = (
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardContent className="flex flex-col gap-1">
              <p className="text-lg font-medium text-foreground">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              {item.href === null && (
                <p className="text-xs text-muted-foreground">Not available yet</p>
              )}
            </CardContent>
          </Card>
        );

        return item.href === null ? (
          <div key={item.id} aria-disabled="true" className="opacity-70">
            {body}
          </div>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {body}
          </Link>
        );
      })}
    </nav>
  );
}
