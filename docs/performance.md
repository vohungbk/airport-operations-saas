# Performance measurement (VI-F08-S06)

Spec VI-F08 R6 and E2: the key list, detail and create workflows are measured,
and no target is claimed before it is agreed. **No performance target is agreed**
(spec Q2: the targets and the test load are open decisions, and PRD §11.5 says
none are agreed). So the numbers here are measurements and nothing else. They are
not a claim that any workflow is fast enough.

## How to measure

Measure a production build, not the development server: the development server
compiles a page when it is first used, so its numbers are not representative (the
report says so when it sees one).

```bash
npx supabase start
npm run demo:reset          # the data the workflows read
npm run build
npm start                   # in another terminal
npm run perf:measure
```

`perf:measure` (`src/lib/performance/measure.perf.ts`) signs in as the demo admin and
times, for one user and one request after another, after one warm-up each:

| Kind | Workflow |
|---|---|
| List | `/bookings`, `/seats`, `/jobs`, `/incidents` |
| Detail | one booking, seat, job and incident of the demo data |
| Create | the add booking page (`/bookings/new`) and the `create_booking` call |

A page is timed until the whole page has arrived. It writes
`reports/performance.md` (git-ignored) with the minimum, median, 95th percentile
(p95) and maximum of each workflow, the commit, and the server mode.

- It refuses to run unless the app and the Supabase stack are local: it signs in
  with the demo account.
- Creating a booking adds bookings to the local database, and bookings cannot be
  deleted. `npm run demo:reset` puts the database back. Set `PERF_CREATE=0` to leave
  the create call out.
- Options: `PERF_RUNS` (timed requests per page, 20 by default), `PERF_CREATE_RUNS`
  (5 by default), `PERF_BASE_URL` (a local address).
- It is not part of `npm test` or of `npm run release:gates`: it needs a running app.

## A measurement

One run on one machine (node 22, macOS on Apple silicon, a production build, the
local database with the demo data, 20 runs per page and 5 creates). It shows what
the report looks like and the order of the figures on that machine. It is not a
target and says nothing about another machine or a real load. Times in milliseconds.

| Workflow | Median | p95 | Max |
|---|---|---|---|
| Bookings list | 26 | 73 | 81 |
| Seats list | 20 | 26 | 32 |
| Jobs list | 15 | 18 | 23 |
| Incidents list | 15 | 23 | 28 |
| Booking detail | 12 | 14 | 41 |
| Seat detail | 11 | 14 | 21 |
| Job detail | 11 | 12 | 12 |
| Incident detail | 11 | 12 | 13 |
| Add booking page | 12 | 14 | 15 |
| Create a booking (5 runs) | 5 | 8 | 8 |

What the numbers do not cover: a production database, many users at once, a real
network, or the time the browser takes to draw the page. Load at the scale of
production is out of scope until targets exist (spec OOS-2).

## When a target is agreed

A target is added only after a person who can decide has agreed it. Add it to
`AGREED_TARGETS` in `src/lib/performance/targets.ts` with the workflow id (from
`WORKFLOWS` in `measure.ts`), the limit for p95 in milliseconds, who agreed it, the
date and the load it holds for (machine, data, number of users). From then on the
report compares that workflow with its limit and says within or over, with who
agreed it. A target with a missing field is not a target: the workflow stays
measured only, and the report says the target was not used. A target for a workflow
that does not exist is not used either.

Until then, a workflow with no agreed target is never given a verdict.
