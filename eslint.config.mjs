import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Accessibility rules beyond the few that eslint-config-next turns on (VI-F08-S04,
 * spec R4): labels, keyboard use, focus. The plugin comes with eslint-config-next.
 * `Button` and `Link` are not mapped to `button` and `a`: they take their content
 * through the `render` prop or from components, which these rules cannot see.
 */
const accessibilityRules = {
  "jsx-a11y/label-has-associated-control": ["error", { assert: "either", depth: 3 }],
  "jsx-a11y/control-has-associated-label": [
    "error",
    {
      ignoreElements: ["audio", "canvas", "embed", "input", "textarea", "tr", "video"],
      ignoreRoles: ["grid", "listbox", "menu", "menubar", "radiogroup", "row", "tablist", "toolbar", "tree", "treegrid"],
      includeRoles: ["alert", "dialog"],
    },
  ],
  "jsx-a11y/click-events-have-key-events": "error",
  "jsx-a11y/no-static-element-interactions": "error",
  "jsx-a11y/no-noninteractive-element-interactions": "error",
  "jsx-a11y/interactive-supports-focus": "error",
  "jsx-a11y/no-noninteractive-tabindex": "error",
  "jsx-a11y/tabindex-no-positive": "error",
  "jsx-a11y/no-autofocus": "error",
  "jsx-a11y/anchor-is-valid": "error",
  "jsx-a11y/anchor-has-content": "error",
  "jsx-a11y/heading-has-content": "error",
  "jsx-a11y/no-aria-hidden-on-focusable": "error",
  "jsx-a11y/no-redundant-roles": "error",
  "jsx-a11y/scope": "error",
  "jsx-a11y/mouse-events-have-key-events": "error",
  "jsx-a11y/no-onchange": "error",
};

const accessibilitySettings = {
  "jsx-a11y": {
    components: {
      Input: "input",
      Textarea: "textarea",
      Select: "select",
      Label: "label",
      FieldLabel: "label",
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.tsx"],
    ignores: ["**/*.test.*"],
    settings: accessibilitySettings,
    rules: accessibilityRules,
  },
  {
    // Generic wrappers: the label gets its control from whoever uses it.
    files: ["src/components/ui/**"],
    rules: { "jsx-a11y/label-has-associated-control": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Supabase CLI runtime artifacts (gitignored, not source):
    "supabase/.temp/**",
    "supabase/.branches/**",
  ]),
]);

export default eslintConfig;
