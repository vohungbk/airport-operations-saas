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

