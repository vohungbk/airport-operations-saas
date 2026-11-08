import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/roi/actions/save-baseline-inputs.action", () => ({ saveBaselineInputsAction: vi.fn() }));

import { BaselineInputsForm } from "@/features/roi/components/baseline-inputs-form";
import { BASELINE_FIELDS, type BaselineValues } from "@/features/roi/lib/baseline-inputs";

const SAVED = Object.fromEntries(BASELINE_FIELDS.map((field) => [field.name, 1])) as BaselineValues;

const render = (defaultValues?: BaselineValues) => renderToStaticMarkup(createElement(BaselineInputsForm, { defaultValues }));

describe("BaselineInputsForm (VI-F05-S05, AC01, AC02, AC08, AC09)", () => {
  it("should offer the 14 fields of the design with their labels, each as a number input (AC01)", () => {
    const html = render();

    expect(html.match(/type="number"/g)).toHaveLength(14);
    for (const label of [
      "Monthly staff cost · USD",
      "Handling cost per rental · USD",
      "Owned seats",
      "Expected programme handling minutes",
      "Average daily price · USD",
      "Baseline conversion · %",
      "Programme conversion · %",
      "Qualified enquiries",
      "Average contribution per rental · USD",
    ]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("should draw the three groups and the note of the design (AC02)", () => {
    const html = render();

    expect(html).toContain(">Current costs<");
    expect(html).toContain(">Inventory and handling<");
    expect(html).toContain(">Pricing and conversion<");
    expect(html).toContain("Used only in estimated business value. Save an updated version to preserve a comparable history.");
  });

  it("should draw the Save baseline version button and a Discard changes link back to the ROI dashboard (AC08, AC09)", () => {
    const html = render();

    expect(html).toContain(">Save baseline version<");
    expect(html).toMatch(/<a[^>]*href="\/partner\/roi"[^>]*>Discard changes<\/a>/);
  });

  it("should show no error before the user has done anything (Empty)", () => {
    const html = render();

    expect(html).not.toContain("Could not save the baseline inputs");
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("should switch off the validation of the browser, so the messages come from the schema (AC03 to AC05)", () => {
    expect(render(SAVED)).toContain("noValidate");
  });
});
