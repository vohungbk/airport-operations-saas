import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from "lucide-react";

import {
  inspectionResultLabel,
  type InspectionResult,
} from "@/features/inspections/schemas/record-inspection.schema";

function resultIcon(result: InspectionResult): LucideIcon {
  if (result === "pass") return CircleCheck;
  if (result === "conditional_pass") return TriangleAlert;

  return CircleX;
}

/** A result as icon and text: the icon never stands alone (AC09). */
export function InspectionResultLabel({ result }: { result: InspectionResult }) {
  const Icon = resultIcon(result);

  return (
    <span className="inline-flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {inspectionResultLabel(result)}
    </span>
  );
}
