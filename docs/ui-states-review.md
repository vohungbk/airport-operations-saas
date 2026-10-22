# UI states review (VI-F08-S07)

Spec VI-F08 R7: loading, empty, error, permission and not-found states exist where
relevant, so a person is never left unsure. This is what was checked, how, and what
was not.

## The states and where they come from

| State | What shows it | Where |
|---|---|---|
| Loading | `loading.tsx` of the segment: a pulsing skeleton announced as `role="status"` with `aria-busy` and the name "Loading" | 14 segments (`src/app/**/loading.tsx`), built on `PageLoading` |
| Empty | A message in the page of each list: "No seats found. Try adjusting the search or filters, or add a new seat." (the words differ by page and by what the person may do) | the list pages, built on `PageEmpty` |
| Error | `error.tsx` of the segment: a title, a plain sentence and a "Try again" button. It never shows the error that caused it | 15 segments, built on `PageError` |
| Permission | `/forbidden`: "Access denied", with copy that confirms nothing, and a sign out button; three known reasons have their own text | `src/app/forbidden/page.tsx` |
| Not found | `notFound()` for a record that is missing or that the database hides from the person: the same page for both, so it does not tell that a record exists | `src/app/not-found.tsx`, and "Job not found" in `jobs/[id]` |

## What runs on every change

| Check | Where |
|---|---|
| A page that reads data has a loading state and an error state of its own segment (or one above it, short of the app root). A page with an id in its address handles a record that is missing or hidden. A page with a table has a message for when it is empty. A page without one fails the check unless it is listed with the reason. | `src/lib/ui-states/ui-states.test.ts` |
| Every `loading.tsx`, `error.tsx` and `not-found.tsx` renders and says what it must: a loading state is announced as busy, an error state offers a retry and does not show the error that caused it (a message with a table name and an address is passed in and must not appear), a not-found state says so and leads back. | `src/app/ui-state-boundaries.test.ts` |
| The `/forbidden` page: the generic copy, the three reasons it knows, and nothing injected from the address. | `src/app/forbidden/page.test.ts` |
| The partner portal's error boundaries. | `src/app/portal-error-boundaries.test.ts` |
| Which roles may open a page, and what each role may read (the permission and isolation tests). | `src/lib/security`, `src/lib/auth/rls.integration.test.ts` |

Two pages are listed as exceptions with a reason: `/forbidden` and the reset password
page read only the session claims (no database call), so they have no loading or
error state of their own and fall back to the one of the app root.

## Review at a screen (2026-10-22, local app, demo accounts)

Local app, development server, one account at a time.

| State | Account and action | Result |
|---|---|---|
| Permission | Partner user opens `/partners` | Access denied (`/forbidden`) |
| Permission | Technician opens `/partners` | Access denied (`/forbidden`) |
| Not found | Partner user opens a booking of **another partner** | "Page not found", the same page as for an id that does not exist: it does not say the booking exists |
| Not found | Partner user opens a booking id that does not exist | "Page not found" |
| Not found | A page that does not exist (`/no-such-page`) | "Page not found" with a button back |
| Not found | Technician opens a job of **another technician**, and a job id that does not exist | "Job not found. This job does not exist or is no longer assigned to you.", with a "Back to jobs" button; the same words for both |
| Not found | Admin opens a seat id that does not exist | "Page not found" |
| Allowed | Partner user opens a booking of its own partner; technician opens a job of its own | The record shows |
| Empty | Partner user searches bookings for text that matches nothing | "No bookings found. Try adjusting the search or filters, or add a new booking." |
| Empty | Admin searches seats for text that matches nothing | "No seats found. Try adjusting the search or filters, or add a new seat." |
| Loading | The page `/jobs` read as it streams in (a request from the page) | The first chunk of the response holds the loading skeleton (`aria-busy="true"`); the list arrives in a later chunk |

## Noted, not fixed

- The `/forbidden` page offers only "Sign out". A person who is signed in and
  opened a page that is not theirs has no button back to their own home. The page
  is built not to call the auth guards, to avoid a redirect loop, so a link needs
  care (a link to `/` that redirects by role would do). It is a small follow-up of
  its own.
- The "Go back" button of "Page not found" goes to `/`, not to the list the person
  came from, except for jobs, which go back to `/jobs`.
- On the development server the first visit of a page compiles it, and for a few
  seconds the page shows the loading state or only the side bar.

## Not checked

- **The error state on a screen.** It would need the database or the app to fail on
  purpose. It is checked by the render test only: the title, the retry button, and
  that the cause is not shown.
- The loading state as a person sees it in a browser: locally the pages arrive too
  fast to see it. It was seen in the streamed response.
- The pages for an inactive partner and for a partner user with no partner
  (`/forbidden?reason=...`) on a screen; they are covered by `forbidden/page.test.ts`.
- Pages that were not walked: detail and edit pages other than the ones above, and
  the technician forms.
