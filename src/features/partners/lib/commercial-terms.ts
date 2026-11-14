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
  /** The launch credit counted so far, of the version in use; null on an older version. */
  launch_credit_accumulated?: number | null;
  /** Who saved the version; null for a version saved before this was kept. */
  changed_by_name?: string | null;
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

/** The id the Save button of the page header points at (`form="..."`). */
export const COMMERCIAL_TERMS_FORM_ID = "commercial-terms-form";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** `2026-10-01` -> `1 Oct 2026`. */
export function formatTermsDate(date: string): string {
  const [year, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** `6000` -> `6,000.00`: two decimals and thousands separators, as the money fields show it. */
export function formatMoneyText(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The payment terms the Select offers, as the design shows them (Net 14 days). */
export const PAYMENT_TERMS_OPTIONS = [7, 14, 30, 45, 60] as const;

export const paymentTermsLabel = (days: number): string => `Net ${days} days`;

/** The options of the Select: the standard ones, and the saved value too when it is not one of them. */
export function paymentTermsOptions(current: number | null | undefined): number[] {
  const standard: number[] = [...PAYMENT_TERMS_OPTIONS];

  return current != null && Number.isInteger(current) && !standard.includes(current)
    ? [...standard, current].sort((a, b) => a - b)
    : standard;
}

export interface TermsHistoryRow {
  id: string;
  /** `v3`: the order the versions started in, the first one is v1. */
  label: string;
  effective_date: string;
  partner_share: string;
  launch_share: string;
  changed_by: string;
  /** The version in force today. */
  is_current: boolean;
}

/** `v1` for the oldest version, counted over every version of the partner. */
function versionLabels(versions: readonly CommercialTermsVersion[]): Map<string, string> {
  const labels = new Map<string, string>();

  [...versions]
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
    .forEach((version, index) => labels.set(version.id, `v${index + 1}`));

  return labels;
}

/**
 * Pure. The rows of the Terms history, newest first, with the version in force marked, and the label
 * of the terms the page is about ("v3": the one in force, or the latest when none is in force yet).
 */
export function buildTermsHistory(
  versions: readonly CommercialTermsVersion[],
  today: string,
): { rows: TermsHistoryRow[]; currentLabel: string | null } {
  const labels = versionLabels(versions);
  const currentId = pickCommercialTerms(versions, today).current?.id ?? null;
  const sorted = [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  return {
    rows: sorted.map((version) => ({
      id: version.id,
      label: labels.get(version.id) ?? "",
      effective_date: formatTermsDate(version.effective_from),
      partner_share: `${version.partner_share_percent}%`,
      launch_share: `${version.launch_partner_share_percent}%`,
      changed_by: version.changed_by_name ?? "-",
      is_current: version.id === currentId,
    })),
    currentLabel: (currentId ? labels.get(currentId) : sorted[0] ? labels.get(sorted[0].id) : null) ?? null,
  };
}

export interface LaunchCreditProgress {
  accumulated: number;
  target: number;
  /** A whole percent, never above 100. */
  percent: number;
}

/** Pure. The launch credit of the version in force; null when it has no target to reach. */
export function launchCreditProgress(version: CommercialTermsVersion | null): LaunchCreditProgress | null {
  if (!version || version.launch_credit_target === null || version.launch_credit_target <= 0) {
    return null;
  }

  const accumulated = version.launch_credit_accumulated ?? 0;

  return {
    accumulated,
    target: version.launch_credit_target,
    percent: Math.min(100, Math.round((accumulated / version.launch_credit_target) * 100)),
  };
}
