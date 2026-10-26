import { Badge } from "@/components/ui/badge"
import { getStatusLook, type StatusDomain } from "@/lib/status/domain-status"

interface StatusBadgeProps {
  domain: StatusDomain
  value: string
  className?: string
}

/** Icon and text with the token pair of the status, never color alone. A long label is cut and kept in the title. */
function StatusBadge({ domain, value, className }: StatusBadgeProps) {
  const { label, variant, icon: Icon } = getStatusLook(domain, value)

  return (
    <Badge
      variant={variant}
      title={label}
      data-domain={domain}
      data-status={value}
      className={className}
    >
      <Icon aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  )
}

export { StatusBadge }
export type { StatusBadgeProps }
