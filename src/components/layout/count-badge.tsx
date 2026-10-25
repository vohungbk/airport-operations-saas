import { formatCount } from "@/lib/layout/count";

interface CountBadgeProps {
  count: number;
}

/** A small number next to a menu item. It shows `99+` for a large count and nothing for none. */
export function CountBadge({ count }: CountBadgeProps) {
  const text = formatCount(count);
  if (text === null) return null;

  return (
    <span
      title={String(Math.floor(count))}
      className="ml-auto inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
    >
      {text}
    </span>
  );
}
