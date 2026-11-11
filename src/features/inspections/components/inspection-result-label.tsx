import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import {
  inspectionResultLabel,
  type InspectionResult,
} from "@/features/inspections/schemas/record-inspection.schema";

const ICON_CLASS = "size-4 shrink-0";

function ResultIcon({ result }: { result: InspectionResult }) {
  if (result === "pass") return <CircleCheck aria-hidden="true" className={ICON_CLASS} />;
  if (result === "conditional_pass") return <TriangleAlert aria-hidden="true" className={ICON_CLASS} />;

  return <CircleX aria-hidden="true" className={ICON_CLASS} />;
}

/** A result as icon and text: the icon never stands alone (AC09). */
export function InspectionResultLabel({ result }: { result: InspectionResult }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ResultIcon result={result} />
      {inspectionResultLabel(result)}
    </span>
  );
}
