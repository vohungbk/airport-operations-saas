"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SuggestedQuestionChipProps {
  /** One of the questions the assistant supports; the caller gives it, nothing is listed here. */
  question: string
  on_select?: (question: string) => void
  className?: string
}

/** A question the person can pick instead of typing. It wraps a long question and stays 44 px high on a touch screen. */
function SuggestedQuestionChip({ question, on_select, className }: SuggestedQuestionChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      data-slot="suggested-question-chip"
      className={cn("h-auto rounded-full py-1 whitespace-normal", className)}
      onClick={() => on_select?.(question)}
    >
      {question}
    </Button>
  )
}

export { SuggestedQuestionChip }
export type { SuggestedQuestionChipProps }
