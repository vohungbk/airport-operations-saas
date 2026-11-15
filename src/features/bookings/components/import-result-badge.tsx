import { CircleAlert, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { IMPORT_RESULT_LABEL, type ImportResult } from "@/features/bookings/lib/booking-import-history";

const LOOK = {
  completed: { variant: "success", icon: Check },
  completed_with_rejects: { variant: "warning", icon: CircleAlert },
  failed: { variant: "destructive", icon: X },
} as const satisfies Record<ImportResult, { variant: "success" | "warning" | "destructive"; icon: typeof Check }>;

/** CO-F07-S07: the result of an import, icon and text, never color alone. */
export function ImportResultBadge({ result }: { result: ImportResult }) {
  const { variant, icon: Icon } = LOOK[result];

  return (
    <Badge variant={variant} className="h-auto px-2.5 py-1 text-[11px] font-semibold uppercase">
      <Icon aria-hidden="true" />
      {IMPORT_RESULT_LABEL[result]}
    </Badge>
  );
}
