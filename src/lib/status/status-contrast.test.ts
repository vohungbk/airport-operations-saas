import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TEXT_MIN_RATIO, contrastRatio } from "@/lib/accessibility/contrast";
import { resolveColors } from "@/lib/accessibility/token-css";
import { DOMAIN_STATUS, type StatusLook, type StatusVariant } from "@/lib/status/domain-status";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

const PAIR = {
  success: ["success-bg", "success-fg"],
  warning: ["warning-bg", "warning-fg"],
  info: ["info-bg", "info-fg"],
  destructive: ["danger-bg", "danger-fg"],
  muted: ["muted", "muted-foreground"],
} as const;

/** UI-F03-S05 (spec R10): every status variant is readable in Light and in Dark, from tokens only. */
describe.each(["light", "dark"] as const)("status colors in %s", (theme) => {
  const colors = resolveColors(css, theme);
  const used = new Set(Object.values(DOMAIN_STATUS).flatMap((table) => Object.values<StatusLook>(table).map((l) => l.variant)));

  it.each([...used] as StatusVariant[])("should reach the text ratio for the %s variant", (variant) => {
    const [bg, fg] = PAIR[variant];
    expect(colors.has(bg), `--${bg}`).toBe(true);
    expect(colors.has(fg), `--${fg}`).toBe(true);
    const ratio = contrastRatio(colors.get(fg)!, colors.get(bg)!);
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_MIN_RATIO);
  });
});
