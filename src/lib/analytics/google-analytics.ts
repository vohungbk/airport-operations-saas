/**
 * Google Analytics 4 setup. The Measurement ID is public (it is in every page that uses GA), so a
 * `NEXT_PUBLIC_` variable is correct. GA is optional: with no valid ID nothing is loaded, so local
 * development and tests send no data.
 */

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/**
 * Returns the GA4 Measurement ID, or `null` when it is missing or not in the `G-XXXXXXX` form.
 * The variable is read with a literal `process.env.NEXT_PUBLIC_*` access because Next.js inlines it
 * at build time and does not inline dynamic lookups.
 */
export function getGaMeasurementId(
  raw: string | undefined = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
): string | null {
  const value = raw?.trim() ?? "";
  return MEASUREMENT_ID_PATTERN.test(value) ? value : null;
}

/** URL of the gtag.js library for one Measurement ID. */
export function buildGaScriptSrc(measurement_id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurement_id)}`;
}

/**
 * Inline script that sets up `gtag` and sends the first page view. Later route changes are sent by
 * GA4 itself (enhanced measurement listens to the History API), so the App Router needs no hook.
 * Ad personalisation and Google signals are off: this is an operations tool, not an ad product.
 */
export function buildGaInitScript(measurement_id: string): string {
  const config = JSON.stringify({
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(measurement_id)},${config});`;
}
