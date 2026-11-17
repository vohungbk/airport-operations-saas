import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PartnerFormFooterProps {
  isPending: boolean;
  cancelHref: string;
}

/** Save and Cancel under the form. While saving, Save is grey with a spinner and cannot be pressed again. */
export function PartnerFormFooter({ isPending, cancelHref }: PartnerFormFooterProps) {
  return (
    <div className="mt-6 flex items-center gap-2 border-t pt-6">
      <Button
        type="submit"
        variant={isPending ? "secondary" : "default"}
        loading={isPending}
        className="min-h-11 px-4"
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Link
        href={cancelHref}
        className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-primary hover:underline"
      >
        Cancel
      </Link>
    </div>
  );
}
