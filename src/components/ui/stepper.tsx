import { CheckIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StepStatus = "complete" | "current" | "upcoming" | "error"

interface Step {
  label: string
  status: StepStatus
}

interface StepperProps {
  steps: Step[]
  className?: string
}

/** Display only: the caller says which step is done, current, upcoming or in error. */
function Stepper({ steps, className }: StepperProps) {
  return (
    <ol data-slot="stepper" aria-label="Progress" className={cn("flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:gap-4", className)}>
      {steps.map((step, index) => (
        <li
          key={`${index}-${step.label}`}
          data-status={step.status}
          aria-current={step.status === "current" ? "step" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
              step.status === "complete" && "border-primary bg-primary text-primary-foreground",
              step.status === "current" && "border-primary text-primary",
              step.status === "upcoming" && "border-input text-muted-foreground",
              step.status === "error" && "border-destructive bg-danger-bg text-danger-fg"
            )}
          >
            {step.status === "complete" ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : step.status === "error" ? (
              <XIcon className="size-3.5" aria-hidden="true" />
            ) : (
              index + 1
            )}
          </span>
          <span
            title={step.label}
            className={cn("min-w-0 truncate text-sm", step.status === "upcoming" ? "text-muted-foreground" : "font-medium")}
          >
            {step.label}
            {step.status === "error" && <span className="sr-only"> (error)</span>}
            {step.status === "complete" && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export { Stepper }
export type { Step, StepStatus, StepperProps }
