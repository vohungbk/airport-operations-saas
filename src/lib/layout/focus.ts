/**
 * UI-F02-S05 (spec R13): the focus ring of a button of the shell: a solid outline of 2 px, 2 px away,
 * in the `ring` color (4.1:1 on Light, 8.1:1 on Dark). It replaces the pale ring of `Button`, which
 * is half see-through. `outline-solid` is there because `Button` sets `outline-none`.
 */
export const SHELL_BUTTON_FOCUS =
  "focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
