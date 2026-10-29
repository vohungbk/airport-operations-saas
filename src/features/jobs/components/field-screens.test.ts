import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

/** The screens a technician works in on a phone (UI-F07-S05, spec R6). */
const FIELD_SCREENS = [
  "src/features/jobs/components/today-jobs-list.tsx",
  "src/features/jobs/components/today-job-card.tsx",
  "src/features/jobs/components/today-flight-card.tsx",
  "src/features/jobs/components/today-parts.tsx",
  "src/features/jobs/components/next-jobs-card.tsx",
  "src/features/jobs/components/step-done.tsx",
  "src/features/jobs/components/step-action-bar.tsx",
  "src/features/jobs/components/offline-banner.tsx",
  "src/features/jobs/components/job-detail.tsx",
  "src/features/jobs/components/job-action-error-alert.tsx",
  "src/features/installations/components/seat-scan-flow.tsx",
  "src/features/installations/components/seat-scan-result.tsx",
  "src/features/installations/components/scan-banner.tsx",
  "src/features/installations/components/installation-form.tsx",
  "src/features/cleaning/components/cleaning-start-panel.tsx",
  "src/features/cleaning/components/cleaning-complete-form.tsx",
  "src/features/inspections/components/inspection-form.tsx",
];

describe("The field screens on a phone (UI-F07-S05, spec R6)", () => {
  it.each(FIELD_SCREENS)("should not set text under 14 px in %s", (file) => {
    // text-xs is 12 px, text-caption is 11 px, and a bracket size is checked as a number of px or rem.
    expect(read(file)).not.toMatch(/\btext-(?:xs|caption)\b/);
    expect(read(file)).not.toMatch(/\btext-\[(?:1[0-3]px|0?\.[0-8]\d*rem)\]/);
  });

  it.each(FIELD_SCREENS)("should give every button of %s a height of 44 px", (file) => {
    const source = read(file);
    const buttons = [...source.matchAll(/<Button\b|buttonVariants\(/g)];

    for (const { index } of buttons) {
      expect(source.slice(index, index + 300)).toContain("min-h-11");
    }
  });

  it.each([
    "src/features/cleaning/components/cleaning-complete-form.tsx",
    "src/features/inspections/components/inspection-form.tsx",
  ])("should give each choice of the radios in %s a row of 44 px", (file) => {
    const source = read(file);

    expect(source).toMatch(/<label [^>]*min-h-11/);
    expect(source).not.toMatch(/<label [^>]*"flex items-center gap-2"/);
  });
});

describe("Badge on a touch screen", () => {
  it("should be 14 px text and 24 px high for a finger, and keep 12 px and 20 px for a mouse", () => {
    const out = renderToStaticMarkup(createElement(Badge, null, "Assigned"));

    expect(out).toContain("pointer-coarse:text-sm");
    expect(out).toContain("pointer-coarse:h-6");
    expect(out).toContain("h-5");
    expect(out).toContain("text-xs");
  });
});
