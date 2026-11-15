"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import type {
  INSTALLATION_CHECKLIST,
  InstallationChecklistKey,
} from "@/features/installations/lib/installation-checklist";

interface InstallationChecklistStepProps {
  items: typeof INSTALLATION_CHECKLIST;
  checked: readonly string[];
  total: number;
  completed: number;
  /** The line under the button; absent once every item is checked. */
  hint: string | null;
  /** Names the missing items after a Continue that was refused. */
  error?: string;
  onToggle: (key: InstallationChecklistKey) => void;
  onContinue: () => void;
}

/**
 * The first step of recording an installation (ME3). It shows the checklist and sends nothing: the form
 * owns what is checked and the schema says what is missing.
 */
export function InstallationChecklistStep({
  items,
  checked,
  total,
  completed,
  hint,
  error,
  onToggle,
  onContinue,
}: InstallationChecklistStepProps) {
  return (
    <>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Installation checklist</CardTitle>
          <CardDescription>
            All checks are required · {completed} of {total} complete
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground">
                  <Checkbox
                    checked={checked.includes(item.key)}
                    onCheckedChange={() => onToggle(item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <FieldError errors={error ? [{ message: error }] : undefined} />
        </CardContent>
      </Card>
      <div className="flex max-w-lg flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start bg-surface px-4 dark:bg-surface"
          onClick={onContinue}
        >
          Continue to photos
        </Button>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    </>
  );
}
