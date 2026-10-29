import type { ReactNode } from "react";

interface StepActionBarProps {
  children: ReactNode;
}

/**
 * The main action of a step, where the thumb is (UI-F07-S03, spec R3, R7). On a phone the bar is fixed above
 * the bottom navigation and the content above it scrolls (a form gives its end the room with `pb-24`); from
 * 768 px up it sits in the flow, below the content. The bar holds the one main action and, beside it, the way
 * out. It is `fixed`, not `sticky`, because the card around a form clips with `overflow-hidden`. The offset of
 * 4.25rem is the height of the bottom navigation (`min-h-17` in `bottom-nav.tsx`): change both together.
 */
export function StepActionBar({ children }: StepActionBarProps) {
  return (
    <div
      data-slot="step-action-bar"
      className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t border-border bg-card p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0"
    >
      {children}
    </div>
  );
}
