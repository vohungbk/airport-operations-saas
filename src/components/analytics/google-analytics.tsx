import Script from "next/script";

import {
  buildGaInitScript,
  buildGaScriptSrc,
  getGaMeasurementId,
} from "@/lib/analytics/google-analytics";

/**
 * Loads Google Analytics 4 once for the whole app. Renders nothing when
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is not set to a valid ID.
 */
export function GoogleAnalytics() {
  const measurement_id = getGaMeasurementId();
  if (!measurement_id) return null;

  return (
    <>
      <Script src={buildGaScriptSrc(measurement_id)} strategy="afterInteractive" />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildGaInitScript(measurement_id) }}
      />
    </>
  );
}
