import { FLIGHT_SOURCE_LABELS, formatLastSync } from "@/features/flights/lib/provider-status-labels";
import type { ProviderStatus } from "@/features/flights/lib/get-provider-status";

interface ProviderStatusCardProps {
  status: ProviderStatus;
}

interface StatusRowProps {
  label: string;
  value: string;
}

function StatusRow({ label, value }: StatusRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * VI-F02-S09 (spec R5): read-only status of the active flight source. Credentials are never
 * part of the status, so they cannot be shown here.
 */
export function ProviderStatusCard({ status }: ProviderStatusCardProps) {
  return (
    <dl className="grid max-w-xl gap-4 rounded-lg border border-border p-4">
      <StatusRow label="Active source" value={FLIGHT_SOURCE_LABELS[status.source]} />
      <StatusRow label="Last sync" value={formatLastSync(status.last_synced_at)} />
      <StatusRow label="Last error" value={status.last_error ?? "None"} />
    </dl>
  );
}
