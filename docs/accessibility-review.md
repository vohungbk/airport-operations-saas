# Accessibility review (VI-F08-S04)

Spec VI-F08 R4: keyboard use, visible focus, labels, validation messages and
status cues that are not colour alone are checked. **No WCAG level is claimed**:
the target level is an open decision (spec Q1). This is what was checked, how,
and what was not.

## What runs on every change

These run with `npm run lint` and `npm test`, so they are part of the lint and
tests gates of `npm run release:gates`.

| R4 item | Check | Where |
|---|---|---|
| Labels | A label must point to a control (`jsx-a11y/label-has-associated-control`, with `Label` and `FieldLabel` mapped to `label`). Every form control has a name: a label that points to it, a label around it, or an `aria-label`. | `eslint.config.mjs`; `findUnlabelledControls` in `src/lib/accessibility/accessibility.test.ts` |
| Keyboard use | No click handler on an element that cannot be reached or used with the keyboard, no positive `tabIndex`, no `autoFocus`, no link without an address. | `eslint.config.mjs` (`click-events-have-key-events`, `no-static-element-interactions`, `interactive-supports-focus`, `tabindex-no-positive`, `no-autofocus`, `anchor-is-valid` and others) |
| Visible focus | No class string takes the outline away without a focus ring, border or highlight in its place. The one exception is the panel of a dialog, and it is listed with its reason. | `src/lib/accessibility/accessibility.test.ts` |
| Validation messages | A file that marks a field invalid also has a message for it; the message is announced as an alert. A field with an error is `aria-invalid` and points to its message with `aria-describedby`. | `accessibility.test.ts`; the form tests |
| Status cues | Each status badge writes the state in words, a different word for each state; the icon is hidden from a screen reader since the word says it. A button with only an icon has a name. | `accessibility.test.ts` |
| The rules bite | A component with each defect is linted from text with the real config and must be reported. | `src/lib/accessibility/eslint-rules.test.ts` |

The checks read the source, so they are a floor. They do not tell the order of
the Tab key on a page or how a focus ring looks.

## Found and fixed

| Finding | Where | Fix |
|---|---|---|
| The label of a group of radio buttons ("Result", "Inspection result") was a `label` with no control: a screen reader did not read the question with each choice, and the error was not tied to the group. | Cleaning complete form, inspection form | The group is a `fieldset` with a `legend`, and the fieldset points to its error with `aria-describedby`. Tests in both form tests. |

The other eleven reports of the stricter rules were not defects: the close button
of a dialog has its name in a `sr-only` span, the triggers and links that the rule
could not see into have text, and the two generic wrappers (`label.tsx`,
`field.tsx`) get their control from whoever uses them.

## Review at a screen (2026-10-22, local app, demo admin account)

Done in the built-in browser of the Claude desktop app, with the keyboard.

| Screen | Check | Result |
|---|---|---|
| Sign in (`/login`) | Tab order: Email, Password, Sign in, Forgot your password, Sign up, the same as the order on the page. | Pass |
| | Visible focus on each of the five controls. The inputs and the button show a 3 px ring (the button after its short transition); the links show an outline. | Pass |
| | Each input has a label that reads its name. Submitting with Enter from the password field signs in. | Pass |
| Bookings list (`/bookings`) | 48 controls: all have a name, except two hidden inputs inside the select component (not shown to the user). | Pass |
| | A status is written in words with an icon that is hidden from a screen reader ("Pending", "Cancelled"). | Pass |
| | The sort links work with Enter, and the sorted column gets `aria-sort` and an arrow in its text. | Pass |
| | One `main`, two `nav`, a search region, `lang="en"`, one `h1`. | Pass |
| | The table has no caption or accessible name of its own; the `h1` above it names the page. | Noted, not fixed |
| Add seat (`/seats/new`) | All eight fields have a label. | Pass |
| | Submitting empty: eight fields are `aria-invalid`, each points to its own message with `aria-describedby`, each message is an alert with text, and focus moves to the first invalid field. The message is text, not only a red border. | Pass |
| | The form does not say which fields are required before the submit: no `aria-required` and no mark on the label. | Noted, not fixed |

## Not checked

- Focus trap and Escape in dialogs (change status, deactivate), and focus returning
  to the button that opened them.
- Colour contrast of text, of the focus ring (it is drawn at 50 % opacity) and of
  the status badges. The target level (Q1) decides what is needed.
- Zoom and reflow, and the mobile layout (spec R5, a different story).
- A screen reader. Names, roles and states were read from the page, not heard.
- The screens that were not walked: partner portal, technician pages, incidents.
  The automated checks above do cover their source.
