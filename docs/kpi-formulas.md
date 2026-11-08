# KPI formulas (VI-F05-S03)

One line per KPI of the KPI dashboard: the formula, where the data comes from, and a note. The words are written once in
`src/lib/kpi/kpi-definitions.ts`; the dashboard shows them in the formula popover of each tile, and
`src/lib/kpi/kpi-definitions-doc.test.ts` fails when this table and that file differ. An export or the
assistant that shows a KPI reads the same file, so every place says the same formula (spec R8).

A "completed booking" is a booking that is returned, in cleaning, in inspection or completed, whose return time falls in
the period. A period is a UTC calendar month, year to date, or a chosen month, and never in the future.

| KPI | Formula | Data source | Note |
|---|---|---|---|
| Correct-seat fulfilment | Allocated seat installed ÷ completed bookings × 100 | Bookings and installation records (seat scan result) | Excludes cancelled bookings and no-shows. Based on verified scan and installation records. |
| Family Ready on time | Bookings Family Ready before their deadline ÷ bookings Family Ready × 100 | Bookings (Family Ready time) and installation job deadlines | A booking with no stored deadline is left out of the rate. |
| Cleaning / inspection traceability | Completed bookings with a cleaning and an inspection record ÷ completed bookings × 100 | Bookings, cleaning records and inspection records | A completed booking is returned, cleaning, inspection or completed, by return time. A missing record is a gap. |
| Operational incidents | Incidents linked to the completed bookings | Incidents and bookings | The percentage under the value is incidents per completed booking. |
| Commercial performance | Sum of the partner revenue share of the completed bookings | Bookings (partner share) | In USD. A booking with no calculated share is left out, not counted as 0. |
| Seat utilisation | Rented seat-days ÷ available seat-days × 100 | Bookings and seats | Available seat-days count every seat in service in the period, at every airport. Rented seat-days are the rentals the viewer may see. |
| Average rental duration | Paid days ÷ completed rentals | Bookings (paid days) | In days. |
| Inventory buffer | Seats with status available now | Seats and airports | Counted at every airport. It does not depend on the period. |
| Replacement rate | Seat replacements ÷ completed rentals × 100 | Booking events (seat changes) | A first seat assignment, or a seat taken off with none put in its place, is not a replacement. |
| Average preparation | Average time from the first move to Preparation to the first move to Ready | Booking events (status changes) | A booking with no Preparation step is left out of the average. |
| Installation time | Average time from install start to completed | Technician jobs (installation) | A job with no start time is left out of the average. |
| Refunds | Sum of the partial and full refunds of the completed bookings | Booking adjustments | In USD. Chargebacks and manual adjustments are not refunds. |
| Complaints | Complaints recorded in the period | No source yet: no complaint record exists | Shown as Not available until the PO confirms where complaints come from (spec Q3). |
| Monthly partner revenue | Sum of the partner revenue share of the completed bookings | Bookings (partner share) | In USD. The same figure as Commercial performance for the same scope and period. |

## ROI estimate formulas (VI-F05-S06)

The estimated lines of the ROI dashboard of a partner. Every one is an estimate modelled from the saved baseline inputs
and the verified rentals of the period; it is labelled Estimate and never added to a verified figure other than in the
one total that says so. The words are written once in `src/features/roi/lib/roi-definitions.ts`, and
`src/features/roi/lib/roi-definitions-doc.test.ts` fails when this table and that file differ.

These formulas are a working assumption: spec Q2 (how each avoided cost is calculated) and Q4 (calendar rules) are still
open until the PO answers. A period of year to date counts the months so far this year, the current month included. With
no baseline saved, the estimated lines say Not available.

| ROI line | Formula | Data source | Note |
|---|---|---|---|
| Avoided handling | Handling cost per rental × completed rentals | Baseline inputs and completed bookings | Estimate. The rentals are the verified rentals of the period. |
| Inventory savings | (Monthly inventory cost − programme inventory cost) × months in the period | Baseline inputs | Estimate. Year to date counts the months so far this year, the current month included. |
| Conversion value | (Programme conversion − baseline conversion) × qualified enquiries × months × average contribution per rental | Baseline inputs | Estimate. The first part is the incremental rentals shown under the value. |
| Estimated avoided costs | Avoided handling + inventory savings | The two lines above | Estimate. Conversion value is a separate card. |
| Total partner value created | Verified partner revenue + avoided handling + inventory savings + conversion value | Verified partner revenue and the three estimated lines | Estimate. Onboarding and annual fees are not taken off yet (spec R6 is open). Not available when the verified revenue is not. |
| Monthly total trend | Total partner value created, worked out for each of the last six calendar months | Verified partner revenue and baseline inputs | Estimate. Ends with the last month of the period; year to date ends with the current month. A month with no figures is Not available. |
