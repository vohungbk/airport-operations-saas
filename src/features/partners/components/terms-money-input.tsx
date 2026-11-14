"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoneyText } from "@/features/partners/lib/commercial-terms";

interface TermsMoneyInputProps {
  id: string;
  name: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  disabled?: boolean;
  invalid?: boolean;
  /** An empty box is "none" (null), not "not a number". */
  optional?: boolean;
}

/**
 * A money box as the design shows it: `10,000.00` when it is left, the plain number while it is typed
 * in. The form holds a number (or null), never the text with the separators.
 */
export function TermsMoneyInput({
  id,
  name,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  optional = false,
}: TermsMoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const hasValue = typeof value === "number" && Number.isFinite(value);

  return (
    <Input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="h-11"
      aria-invalid={invalid}
      disabled={disabled}
      value={focused ? text : hasValue ? formatMoneyText(value) : ""}
      onFocus={() => {
        setText(hasValue ? String(value) : "");
        setFocused(true);
      }}
      onChange={(event) => {
        setText(event.target.value);
        const cleaned = event.target.value.replace(/[,\s]/g, "");

        onChange(cleaned === "" ? (optional ? null : Number.NaN) : Number(cleaned));
      }}
      onBlur={() => {
        setFocused(false);
        onBlur();
      }}
    />
  );
}
