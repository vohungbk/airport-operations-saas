import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { DASHBOARD_ROUTE } from "@/lib/constants/routes";

/**
 * Shown by `forbidden()` (a 403) inside the shell, so the menu stays usable (VI-F09-S01, Permission
 * denied). It says who may open the invoices, not which permission the user lacks.
 */
export default function InvoicesForbidden() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Invoices</h1>
        <p className="text-sm text-muted-foreground">Invoices for your account</p>
      </div>
      <Alert variant="destructive">
        <AlertTitle>You do not have access to invoices.</AlertTitle>
        <AlertDescription>Invoices are available to Partner Users, Admins, and Operations Managers.</AlertDescription>
      </Alert>
      <div>
        <Link href={DASHBOARD_ROUTE} className={buttonVariants({ variant: "outline", className: "min-h-11 px-4" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
