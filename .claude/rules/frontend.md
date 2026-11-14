# Frontend Rules

Scope: everything under `src/app`, `src/components`, and the UI layer of
`src/features/*`. These rules extend, not replace, the architecture in
`docs/architecture.md` (Server Components by default, mutations through
Server Actions/Route Handlers).

## Component conventions

- **Functional components only.** No class components.
- **Explicit props typing.** Every component takes a named `interface`/
  `type` for its props — no inferred/implicit `any`, no untyped
  destructuring from `props: any`. Avoid `React.FC` (it adds an implicit
  `children` and complicates generics); type props directly on the
  function signature instead:

  ```tsx
  interface BookingCardProps {
    booking: Booking;
    onCancel?: (bookingId: string) => void;
  }

  export function BookingCard({ booking, onCancel }: BookingCardProps) {
    // ...
  }
  ```

- **Extract custom hooks for business logic.** A component's job is to
  render. Any non-trivial logic — derived state, side effects,
  subscriptions, orchestration of multiple pieces of state — belongs in a
  `use*` hook colocated with the feature (e.g.
  `src/features/bookings/use-booking-status.ts`), not inlined in the
  component body. This is the same rule as `CLAUDE.md`'s "business logic
  must not be scattered across React components," applied specifically to
  hooks vs. components.
- **Server vs. Client Components.** Default to a Server Component. Add
  `"use client"` only when the component genuinely needs interactivity,
  browser APIs, or a hook that requires the client (state, effects, event
  handlers). Keep the client boundary as small and as low in the tree as
  possible — wrap only the interactive part, not the whole page.

## Styling guidelines

- **Tailwind CSS only.** No CSS Modules, styled-components, Emotion, or
  other styling libraries — none are installed, and adding one is an
  unnecessary dependency (`CLAUDE.md`).
- **No inline `style={{ ... }}`.** Express styling through Tailwind
  utility classes. The only acceptable exception is a genuinely dynamic
  numeric value computed at runtime that has no Tailwind equivalent (e.g.
  a chart bar's pixel width from data) — and even then, prefer a CSS
  custom property set via `style` over hardcoding multiple dynamic
  properties.
- **Conditional classes** go through the existing `cn()` helper in
  `src/lib/utils.ts` (`clsx` + `tailwind-merge`), not manual string
  concatenation or ternaries embedded in `className`.
- **Component variants** (size, intent, state) use
  `class-variance-authority` (`cva`), matching the pattern shadcn/ui
  components under `src/components/ui` already use — don't reinvent
  variant handling with ad hoc conditionals.

## State management patterns

- **Server state** (anything that ultimately comes from Supabase/Postgres)
  is fetched in Server Components by default, per `docs/architecture.md`.
  This project deliberately does **not** run a client-side data-fetching
  library for the common case — no React Query for a page that a Server
  Component can render directly.
  - If a specific feature has a real client-side need that a Server
    Component can't cover — e.g. polling, optimistic UI with complex
    cache invalidation across many components, or client-driven
    pagination/infinite scroll fetching directly from a Route Handler —
    React Query is the approved tool for that server-state-on-the-client
    case. It is not currently a dependency; adding it requires a concrete
    justified use case, not a default choice, and should be reflected as
    a decision in `docs/architecture.md` when it happens.
- **Client state** (UI-only state with no server representation: open/
  closed, active tab, form draft before submit, multi-step wizard step)
  starts with `useState`/`useReducer` local to the component or a custom
  hook. Don't reach for a global store for state one component subtree
  owns.
  - If client state genuinely needs to be shared across distant parts of
    the tree (not solvable by lifting state up or passing props/context a
    couple of levels), Zustand is the approved tool for that global
    client-only state. Like React Query, it is not currently a
    dependency — justify the need before adding it, and keep the store
    scoped to the feature that needs it rather than one app-wide store.
- Never use Redux. Never use either library to hold data that actually
  comes from the database — that's server state, and belongs in the
  Server Component / Server Action flow, not a client store.

## Restyling a screen from Figma

These are hard rules for every UI task that follows a Figma frame. They apply
to every field and button on the screen, not only the ones the ticket names.

- **Match the frame exactly.** Call `get_design_context` for that exact frame
  and look at its screenshot before building (a node tree alone is not reading
  the design). Do not add sections, headings, buttons, links, helper text,
  subtitles, banners, or made-up copy or numbers that are not in the frame. A
  value that has no formula yet is a plain dash. If old behavior or an
  existing test conflicts with the frame, stop and ask; never build a hybrid.
  Name anything that is not in the frame before building, and ask.
- **Form fields are all 44px.** Every `Input` and `SelectTrigger` in a form,
  filter bar or dialog is exactly 44px high. `SelectTrigger` ships
  `data-[size=default]:h-8`, so a plain `h-11` does not win on desktop. Use
  `h-11 data-[size=default]:h-11` on every `SelectTrigger` and `h-11` on every
  `Input`.
- **Buttons are at least 44px.** Every button and link-button on the screen
  (primary, outline, dialog triggers, Clear filters, row actions) gets
  `min-h-11`. The base `Button` is only `min-h-8`. Outline buttons use
  `bg-surface dark:bg-surface`.
- **Check in the browser before saying done.** Open the route in the browser
  at the frame width, compare it with the Figma frame, and measure the real
  heights with `getBoundingClientRect` (fields 44px, buttons at least 44px).
  Do not trust the class names. Put a color class after custom text-size
  tokens in `cn()`, because `tailwind-merge` can drop it. If the browser is
  not signed in, say so and ask the user to sign in. Do not stop or restart a
  dev server the user started.
