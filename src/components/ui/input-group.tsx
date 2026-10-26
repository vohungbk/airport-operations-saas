import * as React from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface InputGroupProps extends React.ComponentProps<"div"> {
  /** Shown inside the box before the text, for example a currency sign or an icon. */
  startSign?: React.ReactNode
  /** Shown inside the box after the text, for example `%`. */
  endSign?: React.ReactNode
}

/**
 * An input with a fixed sign inside its box (UI-F03-S01, spec R2). The sign is decoration: the
 * label of the field says what the number is, so it is hidden from assistive technology. The input
 * inside gets room for it.
 */
function InputGroup({ className, startSign, endSign, children, ...props }: InputGroupProps) {
  return (
    <div
      data-slot="input-group"
      data-start={startSign ? "true" : undefined}
      data-end={endSign ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center data-[start=true]:[&_input]:pl-8 data-[end=true]:[&_input]:pr-8",
        className
      )}
      {...props}
    >
      {startSign ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 flex items-center text-sm text-muted-foreground [&_svg]:size-4"
        >
          {startSign}
        </span>
      ) : null}
      {children}
      {endSign ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 flex items-center text-sm text-muted-foreground"
        >
          {endSign}
        </span>
      ) : null}
    </div>
  )
}

type InputProps = React.ComponentProps<typeof Input>

interface MoneyInputProps extends InputProps {
  /** The sign of the currency, shown in front of the amount. */
  currency?: string
}

/** An amount of money: decimal keyboard on a phone, the currency sign in front. */
function MoneyInput({ currency = "$", ...props }: MoneyInputProps) {
  return (
    <InputGroup startSign={currency}>
      <Input type="text" inputMode="decimal" {...props} />
    </InputGroup>
  )
}

/** A percentage: decimal keyboard on a phone, `%` after the number. */
function PercentInput(props: InputProps) {
  return (
    <InputGroup endSign="%">
      <Input type="text" inputMode="decimal" {...props} />
    </InputGroup>
  )
}

/** A search box: a magnifier in front, the search keyboard on a phone. */
function SearchInput(props: InputProps) {
  return (
    <InputGroup startSign={<Search />}>
      <Input type="search" {...props} />
    </InputGroup>
  )
}

export { InputGroup, MoneyInput, PercentInput, SearchInput }
