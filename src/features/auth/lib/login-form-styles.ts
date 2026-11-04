/**
 * The look of the sign in form, taken from the sign in frame of the design. They sit on the shared
 * Field, Input, Button and TextLink; only what the frame changes is set here.
 */

/** A label and its control are 6 px apart. */
export const LOGIN_FIELD_CLASS = "gap-1.5";

/** The label is 14 px, semibold. */
export const LOGIN_LABEL_CLASS = "gap-1 text-body font-semibold text-text";

/** A control is 44 px high with a 12 px padding and an 8 px radius; focus is a 2 px focus-ring edge. */
export const LOGIN_CONTROL_CLASS =
  "h-11 rounded-md border-border-input bg-surface px-3 text-body text-text focus-visible:border-focus-ring focus-visible:ring-1 focus-visible:ring-focus-ring";

/** The submit button is as wide as its label, 44 px high, with a 16 px padding. */
export const LOGIN_SUBMIT_CLASS =
  "min-h-11 self-start rounded-md border-primary px-4 py-2.5";

/** The links are muted text with no underline, as in the frame. */
export const LOGIN_LINK_CLASS = "px-0 text-body text-text-muted no-underline";
