import { Badge } from "@/components/ui/badge"

/** Marks a number that is an estimate (spec R11). Text, not color alone. */
function EstimateTag({ className }: { className?: string }) {
  return (
    <Badge variant="outline" data-slot="estimate-tag" className={className}>
      Estimate
    </Badge>
  )
}

export { EstimateTag }
