export interface CommercialTermsVersion {
  id: string;
  partner_share_percent: number;
  platform_share_percent: number;
  launch_partner_share_percent: number;
  launch_credit_target: number | null;
  annual_fee: number;
  onboarding_fee: number;
  vat_rate_percent: number;
  payment_terms_days: number;
  effective_from: string;
  effective_to: string | null;
}

/** The default terms of a new partner (VI-F04 F1, F2, F6); no target, no fees and no VAT until set. */
export const DEFAULT_PARTNER_SHARE_PERCENT = 30;
export const DEFAULT_LAUNCH_PARTNER_SHARE_PERCENT = 50;
export const DEFAULT_PAYMENT_TERMS_DAYS = 14;

/** The date of the server in UTC, as `YYYY-MM-DD`: the date the database calls today. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The platform share is what the partner does not get; rounded to cents of a percent. */
export function platformShareOf(partnerShare: number): number {
  return Math.round((100 - partnerShare) * 100) / 100;
}

export interface PickedCommercialTerms {
  /** The terms in force today, if any. */
  current: CommercialTermsVersion | null;
  /** Terms that start later, soonest first. */
  upcoming: CommercialTermsVersion[];
  /** Terms that have ended, newest first: the history (VI-F04-S03). */
  earlier: CommercialTermsVersion[];
}

/**
 * Pure. From the versions of a partner and the date of today: the one in force, the ones that
 * have not started and the ones that have ended. A version is in force from its start to its end,
 * both included, so a version that ends today is still in force today. The same function gives
 * the terms of a rental for the day it was completed: pass that day instead of today.
 */
export function pickCommercialTerms(
  versions: readonly CommercialTermsVersion[],
  today: string,
): PickedCommercialTerms {
  const current =
    versions
      .filter(
        (version) =>
          version.effective_from <= today && (version.effective_to === null || version.effective_to >= today),
      )
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;

  const upcoming = versions
    .filter((version) => version.effective_from > today)
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));

  const earlier = versions
    .filter((version) => version.effective_to !== null && version.effective_to < today)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  return { current, upcoming, earlier };
}

export interface CommercialTermsFormValues {
  partner_share_percent: number;
  launch_partner_share_percent: number;
  launch_credit_target: number | null;
  annual_fee: number;
  onboarding_fee: number;
  vat_rate_percent: number;
  payment_terms_days: number;
  effective_from: string;
}

/** The day after a `YYYY-MM-DD` date, in UTC. */
export function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * Pure. What the form starts with: the terms of the latest version (or the defaults when the
 * partner has none: 30 and 50, no target, no fees, no VAT, 14 days to pay), and an effective date that the database will accept: today,
 * or the day after the start of the latest version when that is today or later.
 */
export function defaultCommercialTermsFormValues(
  versions: readonly CommercialTermsVersion[],
  today: string,
): CommercialTermsFormValues {
  const latest = [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

  if (!latest) {
    return {
      partner_share_percent: DEFAULT_PARTNER_SHARE_PERCENT,
      launch_partner_share_percent: DEFAULT_LAUNCH_PARTNER_SHARE_PERCENT,
      launch_credit_target: null,
      annual_fee: 0,
      onboarding_fee: 0,
      vat_rate_percent: 0,
      payment_terms_days: DEFAULT_PAYMENT_TERMS_DAYS,
      effective_from: today,
    };
  }

  return {
    partner_share_percent: latest.partner_share_percent,
    launch_partner_share_percent: latest.launch_partner_share_percent,
    launch_credit_target: latest.launch_credit_target,
    annual_fee: latest.annual_fee,
    onboarding_fee: latest.onboarding_fee,
    vat_rate_percent: latest.vat_rate_percent,
    payment_terms_days: latest.payment_terms_days,
    effective_from: latest.effective_from >= today ? dayAfter(latest.effective_from) : today,
  };
}
