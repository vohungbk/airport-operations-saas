## Known limitations

Printed in every release gates report (`npm run release:gates`). Only list what
has been checked; remove a line when it is fixed.

- **The gates run on a developer machine.** There is no CI workflow in the repo.
  The `pre-push` hook runs lint, tests and build, but not the typecheck.
- **The integration tests need the local Supabase stack.** Without it they skip
  themselves, so the tests gate is Not run in that case.
- **One test is not stable when the suites run together.** `demo-data.integration.test.ts`,
  "should have a seat history that ends at the seat's status", fails now and then
  (SEAT-0003 or SEAT-0004 left in `cleaning` by the RLS suite). It fails the same
  way on `main`. Run the gates again, and look at the failing test before you read
  it as a real regression.
- **The gates cover build quality only (VI-F08 R1).** Security and isolation tests
  (R2), data rules (R3), accessibility (R4), responsive layouts (R5) and
  performance (R6) are not run by this command.
- **Open decisions of VI-F08:** the WCAG level (Q1), response-time targets and test
  load (Q2), supported browsers and devices (Q3), and who signs off release
  readiness (Q4). Until they are answered, no target is claimed and the spec has
  no sign-off.
- **History is not audited across every row.** The history chains are checked on the
  demo data and in the lifecycles the RLS suite creates itself. Other suites insert
  records directly as fixtures (for example incidents that are not `open`, with no
  history row), so a check over all rows of a shared test database would report
  false problems. See [data-rules.md](data-rules.md).

- **The security coverage check is a floor.** It finds a rule with no test, or a
  test with no refusal case. It does not tell whether a table's isolation is tested
  deeply: for that it only asks that the RLS integration suite names the table.
- **Accessibility is checked in part, and no WCAG level is claimed.** Labels, keyboard
  rules, visible focus, validation messages and status cues are checked from the
  source on every change, and three screens were walked by hand. Contrast, zoom,
  dialog focus and a screen reader were not checked. A required field is not marked
  before the submit, and a table has no caption. See [accessibility-review.md](accessibility-review.md).
- **Responsive layout is checked in part, and no devices are claimed.** The search
  boxes, fixed widths, tables and zoom are checked from the source on every change,
  and most pages were measured at 320, 375, 768 and 1280 px in one browser. Real
  devices, other browsers, text zoom, and the small touch size of links in tables
  were not checked, and a table scrolls sideways on a phone. See [responsive-review.md](responsive-review.md).
- **Performance is measured, and no target is claimed.** No target or test load is agreed
  (spec Q2), so `npm run perf:measure` only reports figures, for one user on a local
  machine, and is not part of the release gates. It does not cover a production
  database, many users, a real network or the time the browser takes to draw the page.
  See [performance.md](performance.md).
- **UI states are checked in part.** Every page that reads data has a loading and an
  error state, every page with an id handles a missing record, every list has an empty
  message, and these are checked from the source on every change. The error state was
  not seen on a screen, and the loading state only in the streamed response. The
  `/forbidden` page offers only "Sign out". See [ui-states-review.md](ui-states-review.md).
- **The release readiness report states facts and does not judge.** It lists the gates, the
  migrations, the names of the variables and the settings of the project, the limitations and
  the open decisions, and records no sign-off (spec Q4). The regression journeys are checked to
  have a test in place; a deliberate break was not run (see [release-readiness.md](release-readiness.md)).
- **The dashboard charts are bars made of text and CSS.** The chart library and the chart
  types are an open decision (spec VI-F01 Q5), so no library is added. Each bar is a count
  query of its own (22 for an admin, with the 8 of the cards); a count of all statuses in
  one query would need a function in the database.
- **How long a cleaning is taken to last is an assumption.** A cleaning cannot start while a
  booking holds or uses the seat in the next two hours (spec FO-F03 Q6 is open, ticket
  assumption FO-F03-S09-ASM01). The two hours are one constant in `start_cleaning()`; there is no
  cleaning time in the data. See [security.md](security.md), "Cleaning and availability".
- **A scanned seat shows a short read-only card to a technician or a partner.** The full seat
  page stays for operations roles (CO-F04-S13). A technician does not get a seat history or the
  seat's other jobs from a scan; they use the jobs list. A seat QR code keeps the address it was
  made with (`NEXT_PUBLIC_APP_URL`), so set it before printing codes. Download is SVG only.
- **There is no limit on QR scans.** A user can scan as many tokens as they like (CO-F04-S14). A
  token is a random UUID of 122 bits, so guessing one is not practical, and every scan needs a
  session, but there is no rate limit and no alert on many failed scans. That needs
  infrastructure the project does not have.
- **Overlapping commercial terms are stopped by the save function, not by a constraint.** An admin
  who inserts a row directly (the insert policy still allows it) can make two versions of a partner
  overlap. The screen and the future revenue calculation take the version that started last. An
  exclusion constraint on the period would close this; it needs the `btree_gist` extension and is
  left for the story that reads the terms to calculate revenue (VI-F04-S05).
- **The terms history does not show who saved a version.** `partner_commercial_terms` has no
  author column, so the list shows the terms and the days they applied (VI-F04-S03). A record of
  the author and the reason is part of the financial history rule (spec R16) and comes with the
  stories that change money values.

- **The six-day cap is applied, but nothing completes a booking yet.** The trigger calculates the
  paid days and the gross revenue when a booking becomes `completed` (VI-F04-S04), but the workflow
  that completes a rental (the return chain, F14 and F15) is not built, so only the demo data and
  the tests do it. Counting every started 24 hours as a day is an assumption until the product owner decides,
  and a completed rental that was flagged for having no duration cannot be corrected yet.
- **The shares use only the standard partner share (VI-F04-S05).** The launch share and the launch
  credit (spec R12, R13) come with VI-F04-S06. Rounding to the cent is half away from zero, an
  assumption until spec Q1 is decided. A rental completed for a partner with no terms in force gets
  the flag `no_terms` and no shares, and they are not calculated again when terms are added later
  unless its period or rate changes. A booking completed before the migration is not calculated.
- **Launch credit: two rules are assumptions (VI-F04-S06).** A rental that crosses the launch
  target gets the launch share in full and the balance may end above the target (spec Q6 is open).
  A refund or a chargeback does not reduce the launch credit (spec Q4 is open; VI-F04-S09 to S11).
  When a completed rental is calculated again its launch credit is replayed at its own place; the
  rentals completed after it are not calculated again, so their balances can be out of date until
  they are corrected too. There is no switch for launch: a target turns it on, reaching it turns it
  off, and a launch share equal to the standard share never makes progress toward the target.
- **What a cancellation, a no-show and an early return are charged is an assumption (VI-F04-S07).**
  Spec Q3 is open. A cancelled booking and a no-show are not charged (paid days 0, revenue 0.00); an
  early return is charged for the time it lasted. The rule is in `booking_case_revenue()` and the
  completion trigger. Nothing writes `actual_return_at` yet (the return chain, F14 and F15, will), so
  no early return happens outside the tests. Refunds, partial or full, are not handled
  (VI-F04-S09 to S11).
- **The booking revenue screen shows no currency (VI-F04-S08).** The currency is open (spec Q1), so
  amounts show two decimals only. A booking completed before the revenue columns existed
  has no revenue case and shows "No revenue yet".
- **Adjustments (VI-F04-S10): four rules are assumptions.** (1) All four types take money away; the
  spec does not say which way a manual adjustment goes (`booking_adjustment_sign()` is the one place to
  change). (2) The amount of any type is at most the gross revenue the booking has now; "partial" and
  "full" are labels (spec Q3 is open). (3) An adjustment does not change the launch credit (spec Q4 is
  open); the shares are recalculated on the gross revenue that is left. (4) Both an admin and an
  operations manager may add an adjustment (the spec calls the operations manager "conditional"). A
  booking in an approved settlement is not handled (spec Q5, R19, E8) because there are no settlements
  yet. The list of adjustments does not show who recorded them (stored in `created_by`).
