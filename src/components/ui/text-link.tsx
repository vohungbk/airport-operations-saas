import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A link that is a line of text (sign up, back to sign in). It takes the `link` look of the button, so on
 * a touch screen it is at least 44 px high like every other control (UI-F06-S01, spec R10), and it is
 * underlined so it is not told from the text around it by color alone.
 */
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return <Link data-slot="text-link" className={cn(buttonVariants({ variant: "link" }), "underline", className)} {...props} />
}

export { TextLink }
