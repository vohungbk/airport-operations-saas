import type { ReactNode } from "react";

interface PartnersStateCardProps {
  title: string;
  description: string;
  /** The button that gets the user out of the state (Create partner, Clear search, Try again). */
  children?: ReactNode;
  /** `alert` for a state that appears because something failed. */
  role?: "alert";
}

/** The white card of the empty, no-result and error states of the Partners list. */
export function PartnersStateCard({
  title,
  description,
  children,
  role,
}: PartnersStateCardProps) {
  return (
    <div
      role={role}
      className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-6 py-12 text-center"
    >
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-xs text-muted-foreground">{description}</p>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
