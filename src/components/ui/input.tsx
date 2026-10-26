import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * A value that is too long for the box is cut with an ellipsis and kept whole in the title
 * (UI-F03-S01, E2); a password never goes in the title.
 */
function Input({
  className,
  type,
  title,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<"input">) {
  const shown = type === "password" ? undefined : (value ?? defaultValue)

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      title={title ?? (typeof shown === "string" && shown !== "" ? shown : undefined)}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-ellipsis transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
