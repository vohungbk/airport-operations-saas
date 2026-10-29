import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StepActionBar } from "@/features/jobs/components/step-action-bar";
import { StepDone } from "@/features/jobs/components/step-done";
import type { StepDone as StepDoneData } from "@/features/jobs/lib/step-done";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const done: StepDoneData = {
  step: "installation",
  job_id: "j-1",
  booking_number: "BK-2026-000123",
  airport: { code: "DXB", timezone: "Asia/Dubai" },
  seat: { serial_number: "SEAT-0001", category_name: "Convertible" },
  completed_by: "Omar Haddad",
  completed_at: "2026-10-24T10:20:00Z",
};

const render = (props: Partial<Parameters<typeof StepDone>[0]> = {}) =>
  html(createElement(StepDone, { done, nextJobId: null, backHref: "/technician", backLabel: "Back to Today's Jobs", ...props }));

describe("StepDone", () => {
  it("should show the heading, the success message and the summary of the step", () => {
    const out = render();

    expect(out).toContain("Installation success");
    expect(out).toContain("— · BK-2026-000123 · Asia/Dubai");
    expect(out).toContain("Installation completed");
    expect(out).toContain("BK-2026-000123 · Completed at 14:20 GST");
    expect(out).toContain("SEAT-0001 · Convertible");
    expect(out).toContain("Omar Haddad");
  });

  it("should offer the next job as the one main action when another job is waiting (NAV-3)", () => {
    const out = render({ nextJobId: "j-2" });

    expect(out).toContain("Next job");
    expect(out).toContain('href="/jobs/j-2"');
    expect(out).not.toContain("Back to Today");
  });

  it("should offer the way back as the one main action when no job is left", () => {
    const out = render();

    expect(out).toContain("Back to Today&#x27;s Jobs");
    expect(out).toContain('href="/technician"');
    expect(out).not.toContain("Next job");
  });

  it("should put the main action in the bar at the bottom, of at least 44 px", () => {
    const out = render({ nextJobId: "j-2" });

    expect(out).toContain('data-slot="step-action-bar"');
    expect(out).toContain("min-h-11");
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it("should write a dash for a seat or a person that is not known, and make nothing up", () => {
    const out = render({ done: { ...done, seat: null, completed_by: null } });

    expect(out.match(/>—</g)).toHaveLength(2);
    expect(out).not.toContain("Family Ready");
  });

  it("should say the same for a cleaning and an inspection", () => {
    expect(render({ done: { ...done, step: "cleaning" } })).toContain("Cleaning completed");
    expect(render({ done: { ...done, step: "inspection" } })).toContain("Inspection recorded");
  });
});

describe("StepActionBar", () => {
  it("should be fixed above the bottom navigation on a phone and in the flow from 768 px", () => {
    const out = html(createElement(StepActionBar, null, "Save"));

    expect(out).toContain("fixed");
    expect(out).toContain("bottom-[calc(4.25rem+env(safe-area-inset-bottom))]");
    expect(out).toContain("md:static");
    expect(out).toContain("Save");
  });
});

describe("The step screens (UI-F07-S03, spec R3, R7)", () => {
  const FORMS = [
    "src/features/installations/components/installation-form.tsx",
    "src/features/cleaning/components/cleaning-start-panel.tsx",
    "src/features/cleaning/components/cleaning-complete-form.tsx",
    "src/features/inspections/components/inspection-form.tsx",
  ];

  it.each(FORMS)("should put the main action of %s in the bar at the bottom and leave room for it", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");

    expect(source).toContain("<StepActionBar>");
    expect(source).toContain("pb-24 md:pb-0");
    expect(source.match(/<StepActionBar>/g)).toHaveLength(1);
  });
});
