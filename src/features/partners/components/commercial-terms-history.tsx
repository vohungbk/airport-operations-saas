import { TermsCard } from "@/features/partners/components/commercial-terms-summary";
import type { CommercialTermsVersion } from "@/features/partners/lib/commercial-terms";

interface CommercialTermsHistoryProps {
  earlier: CommercialTermsVersion[];
  /** Older versions were cut off by the limit. */
  truncated: boolean;
  limit: number;
}

/**
 * VI-F04 R2: the terms that have ended, with the days they applied, read only. Earlier terms are
 * kept as they were, so what a completed rental was calculated with can still be explained.
 */
export function CommercialTermsHistory({ earlier, truncated, limit }: CommercialTermsHistoryProps) {
  return (
    <section aria-labelledby="terms-history-heading" className="flex flex-col gap-4">
      <h2 id="terms-history-heading" className="text-lg font-medium text-foreground">
        Earlier terms
      </h2>

      {earlier.length === 0 ? (
        <p className="text-sm text-muted-foreground">No earlier terms. Terms that have ended are listed here.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {earlier.map((version) => (
            <li key={version.id}>
              <TermsCard title={`${version.effective_from} to ${version.effective_to}`} version={version} />
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="text-sm text-muted-foreground">Only the latest {limit} versions are shown.</p>
      )}
    </section>
  );
}
