# Responsive layout review (VI-F08-S05)

Spec VI-F08 R5: desktop and mobile layouts are checked. **No list of supported
devices or browsers is claimed**: it is an open decision (spec Q3). This is what
was checked, at which sizes, and what was not.

## What runs on every change

`src/lib/responsive/responsive.test.ts` runs with `npm test`, so it is part of the
tests gate of `npm run release:gates`. It reads the source, so it is a floor: how a
page looks at a size is recorded below from the screen.

| Check | Why |
|---|---|
| No class with a fixed width of 256 px or more that applies from the smallest screen (`w-72`, `w-[300px]`). A width behind a breakpoint (`sm:w-72`), a capped one (`max-w-[85vw]`) or one on an element hidden until a breakpoint passes. | A control wider than the screen widens the whole page. |
| Every search box (an `Input` whose `aria-label` starts with "Search") grows and shrinks with its row (`flex-1` or `w-full`) and has no fixed width on the smallest screens. | A search box with a width of its own, plus its button, is wider than a 320 px phone. |
| A table is used only through the shared `Table` component, which scrolls sideways in its own box. | A wide table must not widen the page. |
| No viewport setting stops zoom (`user-scalable=no`, `maximum-scale`). | A person must be able to zoom. |
| The shell shows a menu header below `md` and the side bar from `md`, and the page content can shrink (`min-w-0`). | The two layouts of the shell. |

## Found and fixed

At 375 px, `/seats`, `/incidents` and `/seat-categories` scrolled sideways (the page
was 388 px wide) and the Search button was cut off: the search box was a fixed
`w-72` (288 px) next to its button. The boxes at `w-64` and `w-60` (partners,
airports, technicians, bookings, jobs) fitted at 375 px but not at 320 px (the page
was 340 px wide).

All nine search forms (seats, partner seats, seat categories, incidents, partners,
airports, technicians, bookings, jobs) now use the full width of the row below the
`sm` breakpoint (640 px) and keep their old width from it. Nothing changes from
640 px up. The check above finds the original seven files when the fix is taken
away.

## Review at a screen (2026-10-22, local app, built-in browser)

Measured as the width of the page against the width of the window, and looked at
in a screenshot. "Fits" means the page is not wider than the window and nothing is
cut off except a table inside its own scrolling box.

| Width | Pages | Result |
|---|---|---|
| 320 px (after the fix) | Dashboard, bookings, add booking, jobs, seats, add seat, incidents, seat categories, partners, airports, technicians; as a partner user: partner home, partner seats, bookings | Fits |
| 375 px (after the fix) | Seats, incidents, seat categories (the three that overflowed); earlier, before the fix: dashboard, bookings, add booking, add seat, jobs, partners, airports, technicians, technician jobs | Fits (the three that did not were fixed) |
| 768 px | Seats, incidents (before the fix; the search forms are unchanged from 640 px) | Fits; the side bar is shown; the tables scroll in their box |
| 1280 px | Bookings as a partner user (after the fix) | Fits; the side bar is shown, there is no menu button; the table needs no scroll; the search box keeps its old width |

Also seen:

- Below 768 px the side bar is replaced by a header with a menu button, and the
  cards of the dashboard stack in one column. No text under 12 px.
- The forms (add booking, add seat) stack in one column and fit at 320 px.

## Noted, not fixed

- Tables are wider than a phone (550 to 1070 px), so they scroll sideways inside their box, and the last
  column (View) is out of sight until the person scrolls. **Partners, airports, seat categories, seats and
  bookings are now cards below 640 px (UI-F06-S02, UI-F06-S03);** the other tables still scroll sideways until their groups are
  restyled (UI-F06).
- Links in tables were small to touch: the column headers that sort were 20 px high, and the View links
  17 px high. **Fixed for the same lists (UI-F06-S02, UI-F06-S03):** both are 44 px high on a touch screen.

## Not checked

- A real phone or tablet, landscape, and other browsers: only the built-in browser
  of the Claude desktop app, at the sizes above.
- Browser text size and zoom to 200 %.
- Pages that were not walked: detail and edit pages, dialogs on a small screen, the
  technician pages as a technician, and the pages of the partner portal other than
  the ones above.
- Print.
