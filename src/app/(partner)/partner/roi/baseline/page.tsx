import { requirePartnerScope } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BaselineInputsForm } from "@/features/roi/components/baseline-inputs-form";
import { BASELINE_TITLE, baselineSubtitle } from "@/features/roi/lib/baseline-inputs";
import { getBaselineInputs } from "@/features/roi/lib/get-baseline-inputs";
import { getPartnerSummary } from "@/features/partners/lib/get-partner-summary";

/**
 * The Baseline inputs screen of a partner (VI-F05-S05). `bookings:manage_own_partner` is guarded here; a
 * role without it gets the 403 of the shell. The scope is never taken from the request: the partner is the
 * one on the signed-in user's own profile, the baseline is read through RLS, and the save goes through a
 * database function that writes for the caller's own partner only. A partner with no baseline yet gets an
 * empty form (Empty). A failed read is thrown to the error boundary, never shown as an empty screen.
 */
export default async function PartnerBaselineInputsPage() {
  const user = await requirePartnerScope("bookings:manage_own_partner");
  const [summary, saved] = await Promise.all([getPartnerSummary(user.partner_id), getBaselineInputs(user.partner_id)]);

  if (summary === null) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-8">
        <Alert variant="destructive">
          <AlertTitle>Your partner could not be found</AlertTitle>
          <AlertDescription>Nothing is shown for it. Contact your administrator if this keeps happening.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{BASELINE_TITLE}</h1>
        <p className="text-sm text-muted-foreground">{baselineSubtitle(summary.name)}</p>
      </div>

      <BaselineInputsForm defaultValues={saved ?? undefined} />
    </div>
  );
}
