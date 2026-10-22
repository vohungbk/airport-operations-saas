import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { FieldError } from "@/components/ui/field";
import {
  findHiddenFocus,
  findUnlabelledControls,
  hasIconButtonWithoutName,
  hasInvalidWithoutMessage,
} from "@/lib/accessibility/audit";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import { INCIDENT_SEVERITY_LABEL } from "@/features/incidents/lib/incident-severity";
import { INCIDENT_STATUS_LABEL } from "@/features/incidents/lib/incident-status";
import { JobStatusBadge } from "@/features/jobs/components/job-status-badge";
import { JOB_STATUS_LABEL } from "@/features/jobs/lib/job-status";
import { PartnerStatusBadge, STATUS_LABEL as PARTNER_STATUS_LABEL } from "@/features/partners/components/partner-status-badge";
import { SeatCategoryStatusBadge } from "@/features/seat-categories/components/seat-category-status-badge";
import { SeatStatusBadge } from "@/features/seats/components/seat-status-badge";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import { TechnicianStatusBadge } from "@/features/technicians/components/technician-status-badge";

/**
 * VI-F08-S04 (spec R4): visible focus, validation messages, and status cues that
 * are not colour alone. The labels and the keyboard are checked by the jsx-a11y
 * rules in eslint.config.mjs (the lint gate), proved to bite by
 * eslint-rules.test.ts. No WCAG level is claimed (spec Q1 is open).
 */
const src = join(process.cwd(), "src");
const sources = (readdirSync(src, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
  .map((file) => ({ file, text: readFileSync(join(src, file), "utf8") }));
const app = sources.filter(({ file }) => !file.startsWith("components/ui/"));

/**
 * Outlines taken away on purpose. The panel of a dialog is not a control: focus
 * is moved onto it by the library when it opens, and its own edge is not a
 * place the person is working in. The controls inside it keep their own ring.
 */
const OUTLINE_REMOVED_ON_PURPOSE = [{ file: "components/ui/dialog.tsx", startsWith: "fixed top-1/2 left-1/2" }];

describe("labels", () => {
  it("should give every form control a name: a label that points to it, a label around it, or an aria-label", () => {
    const unnamed = sources.flatMap(({ file, text }) =>
      findUnlabelledControls(text).map((control) => `${file}: ${control}`),
    );

    expect(unnamed).toEqual([]);
  });

  it.each([
    ["an input with nothing that names it", `export const A = () => <div><input id="a" /></div>;`, 1],
    ["a shared Input with a label that points somewhere else", `export const A = () => <div><Label htmlFor="b">Name</Label><Input id="a" /></div>;`, 1],
    ["a textarea with no id", `export const A = () => <div><FieldLabel>Notes</FieldLabel><textarea /></div>;`, 1],
  ])("should find %s", (_name, code, count) => {
    expect(findUnlabelledControls(code)).toHaveLength(count);
  });

  it.each([
    ["a label that points to the control", `export const A = () => <div><FieldLabel htmlFor="n">Notes</FieldLabel><textarea id="n" /></div>;`],
    ["a control inside its label", `export const A = () => <label><input type="radio" /> Passed</label>;`],
    ["an aria-label", `export const A = () => <input aria-label="Search" />;`],
    ["a hidden input", `export const A = () => <input type="hidden" name="x" />;`],
    ["a wrapper that passes its props on", `export const A = (props: object) => <input {...props} />;`],
  ])("should accept %s", (_name, code) => {
    expect(findUnlabelledControls(code)).toEqual([]);
  });
});

describe("visible focus", () => {
  it("should leave no class string that removes the outline and shows no focus ring, border or highlight in its place", () => {
    const hidden = sources.flatMap(({ file, text }) =>
      findHiddenFocus(text)
        .filter((classes) => !OUTLINE_REMOVED_ON_PURPOSE.some((o) => o.file === file && classes.startsWith(o.startsWith)))
        .map((classes) => `${file}: ${classes.slice(0, 60)}`),
    );

    expect(hidden).toEqual([]);
  });

  it("should find an outline that is removed with nothing in its place", () => {
    expect(findHiddenFocus('className="rounded outline-none"')).toHaveLength(1);
    expect(findHiddenFocus('className="rounded outline-hidden hover:bg-muted"')).toHaveLength(1);
  });

  it.each([
    'className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50"',
    'className="outline-none focus-visible:border-ring"',
    'className="focus-visible:outline-none focus-visible:ring-3"',
  ])("should accept an outline that is replaced by a focus cue: %s", (source) => {
    expect(findHiddenFocus(source)).toEqual([]);
  });

  it("should not take a hover or a focus-visible outline-none alone for a replacement", () => {
    expect(findHiddenFocus('className="outline-none hover:ring-2"')).toHaveLength(1);
    expect(findHiddenFocus('className="focus-visible:outline-none"')).toHaveLength(1);
  });
});

describe("validation messages", () => {
  it("should give every file that marks a field invalid a message for it", () => {
    expect(app.filter(({ text }) => hasInvalidWithoutMessage(text)).map(({ file }) => file)).toEqual([]);
  });

  it("should find a file that marks a field invalid and says nothing about why", () => {
    expect(hasInvalidWithoutMessage('<input aria-invalid={true} />')).toBe(true);
    expect(hasInvalidWithoutMessage('<input aria-invalid /> <FieldError />')).toBe(false);
    expect(hasInvalidWithoutMessage('<input aria-invalid aria-describedby="e" />')).toBe(false);
  });

  it("should announce a field error as an alert, with the text of the message", () => {
    const html = renderToStaticMarkup(
      createElement(FieldError, { id: "x-error", errors: [{ message: "Choose the result." }] }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('id="x-error"');
    expect(html).toContain("Choose the result.");
  });

  it("should render nothing, not an empty alert, when there is no error", () => {
    expect(renderToStaticMarkup(createElement(FieldError, { errors: undefined }))).toBe("");
  });
});

describe("buttons with only an icon", () => {
  it("should give every file with an icon button a name for it", () => {
    expect(app.filter(({ text }) => hasIconButtonWithoutName(text)).map(({ file }) => file)).toEqual([]);
  });

  it("should find an icon button with no name", () => {
    expect(hasIconButtonWithoutName('<Button size="icon"><XIcon /></Button>')).toBe(true);
    expect(hasIconButtonWithoutName('<Button size="icon" aria-label="Menu"><XIcon /></Button>')).toBe(false);
    expect(hasIconButtonWithoutName('<Button size="icon-sm"><span className="sr-only">Close</span></Button>')).toBe(false);
  });
});

describe("status cues that are not colour alone", () => {
  const text = (html: string) => html.replace(/<[^>]*>/g, "").trim();
  const labelsOf = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ props: value, label }));

  const BADGES: [string, FunctionComponent<never>, string, { props: unknown; label: string }[]][] = [
    ["BookingStatusBadge", BookingStatusBadge as FunctionComponent<never>, "status", labelsOf(BOOKING_STATUS_LABEL)],
    ["IncidentSeverityBadge", IncidentSeverityBadge as FunctionComponent<never>, "severity", labelsOf(INCIDENT_SEVERITY_LABEL)],
    ["IncidentStatusBadge", IncidentStatusBadge as FunctionComponent<never>, "status", labelsOf(INCIDENT_STATUS_LABEL)],
    ["JobStatusBadge", JobStatusBadge as FunctionComponent<never>, "status", labelsOf(JOB_STATUS_LABEL)],
    ["PartnerStatusBadge", PartnerStatusBadge as FunctionComponent<never>, "status", labelsOf(PARTNER_STATUS_LABEL)],
    ["SeatStatusBadge", SeatStatusBadge as FunctionComponent<never>, "status", labelsOf(SEAT_STATUS_LABEL)],
    ["SeatCategoryStatusBadge", SeatCategoryStatusBadge as FunctionComponent<never>, "isActive", [{ props: true, label: "Active" }, { props: false, label: "Inactive" }]],
    ["TechnicianStatusBadge", TechnicianStatusBadge as FunctionComponent<never>, "is_active", [{ props: true, label: "Active" }, { props: false, label: "Inactive" }]],
  ];

  it.each(BADGES)("should write the state in words in %s, a different word for each state", (_name, Badge, prop, states) => {
    const words = states.map(({ props, label }) => {
      const html = renderToStaticMarkup(createElement(Badge as FunctionComponent<Record<string, unknown>>, { [prop]: props }));
      expect(text(html), `${prop}=${String(props)}`).toBe(label);
      return text(html);
    });

    expect(states.length).toBeGreaterThanOrEqual(2);
    expect(new Set(words).size).toBe(words.length);
  });

  it.each(BADGES.filter(([name]) => !["PartnerStatusBadge", "TechnicianStatusBadge"].includes(name)))(
    "should hide the icon of %s from a screen reader, since the word says it",
    (_name, Badge, prop, states) => {
      const html = renderToStaticMarkup(
        createElement(Badge as FunctionComponent<Record<string, unknown>>, { [prop]: states[0].props }),
      );

      expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    },
  );
});
