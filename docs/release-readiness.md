# Release readiness report (VI-F08-S08)

Spec VI-F08 R8 and E3: before a release, the migrations, the configuration of the
environment, the known limitations and the unresolved decisions are written down,
and a fix that breaks a journey that passed is caught by the regression suite.

```bash
npm run release:gates     # on a clean tree: typecheck, lint, tests, build
npm run release:report    # writes reports/release-readiness.md (git-ignored)
```

The report states facts for the people who decide. **It does not say that the
release is ready**: who signs off release readiness is an open decision (spec Q4),
and the last section says that no sign-off is recorded.

## What the report holds

| Section | Where it comes from |
|---|---|
| 1. Build gates | `reports/release-gates.md`, the result of `npm run release:gates`. It is trusted only when it was run for the same commit and on a clean tree; otherwise the report says "The gates were not run for this commit". |
| 2. Migrations | The files of `supabase/migrations`: how many, the first and the last, the list, and a warning for a name off the pattern or a repeated timestamp. They are applied in the order of their file names. |
| 3. Configuration of the environment | The names (never the values) of the variables the app reads, found in `src/lib/config/env.ts`; and the settings of the Supabase project that the app depends on, with their local values from `supabase/config.toml` (set the equivalent in the project of the release). The demo seed loads into a local database only. |
| 4. Known limitations | [known-limitations.md](known-limitations.md). |
| 5. Unresolved decisions | `src/lib/release/unresolved-decisions.ts`. |
| 6. Regression coverage | `src/lib/release/journeys.ts`. |
| 7. Sign-off | "Not recorded", until the decision of who signs off is made. |

## Unresolved decisions

Each entry has an id, the source where the question is written, the question, and
what it means for the release while it is open. Every entry must come from a spec or
a doc of the repo. To close one, change its status to `decided` and add what was
decided, who decided it, and the date (`YYYY-MM-DD`): a closed entry with a field
missing is not closed, and the report lists it as not complete.

## The regression suite and the journeys (spec E3)

The regression suite is `npm test`, which is the tests gate of `npm run release:gates`.
A change that breaks a rule that a test checks fails that test before the release.
The key journeys of each role are in `src/lib/release/journeys.ts`, each with the
block of tests that checks it (mostly in the integration suite
`src/lib/auth/rls.integration.test.ts`, which runs against the local database; without
the stack the tests gate is Not run, see [release-gates.md](release-gates.md)).

`journeys.test.ts` fails when:

- a role has fewer than three journeys;
- a journey names no test;
- a test file is gone, or a block was renamed or removed, so that a journey would be
  left with nothing that catches a break.

Add a journey when a feature adds one, with the block of tests that checks it.

### What was and was not shown

- Shown: every one of the 23 journeys names a block that is in its file, each of the
  four roles has at least eight, and the tests gate runs the whole suite.
- **Not shown: a break on purpose.** Changing a rule on purpose (for example removing the
  `cancelled` transition of a pending booking) and seeing `npm test` fail was not run in
  this change, because editing the source of the app for it was not allowed in the
  session. To check it by hand: change one transition in
  `src/features/bookings/lib/booking-status.ts`, run `npm test`, see the tests of
  the booking transitions fail, and restore the file.

## Not covered

- The report reads the repo and the result of the gates. It does not apply the
  migrations, and does not check them against a database of the release.
- It does not know the environment of the release: it lists the names to set and the
  local values, not the values of the release.
- A migration that is not backward compatible is not detected; read the list.
