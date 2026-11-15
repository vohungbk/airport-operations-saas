/** CO-F07-S03, S05: the bar of a step whose length is not known (the server answers in one call). */
export function IndeterminateProgress({ label }: { label: string }) {
  return (
    <div role="progressbar" aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
    </div>
  );
}
