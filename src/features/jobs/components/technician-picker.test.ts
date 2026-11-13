import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TechnicianPicker } from "@/features/jobs/components/technician-picker";

const TECHNICIANS = [
  { value: "t-1", label: "Amir Khan", is_active: true, airport_code: "DXB" },
  { value: "t-2", label: "Sofia Rossi", is_active: false, airport_code: null },
];

function render(value: string, extra: { invalid?: boolean; disabled?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(TechnicianPicker, {
      id: "technician_id",
      technicians: TECHNICIANS,
      value,
      onChange: () => {},
      ...extra,
    }),
  );
}

describe("TechnicianPicker", () => {
  it("should show the placeholder when no technician is chosen", () => {
    expect(render("")).toContain("Select technician");
  });

  it("should show the name of the chosen technician", () => {
    const html = render("t-1");

    expect(html).toContain("Amir Khan");
    expect(html).not.toContain("Select technician");
  });

  it("should mark the trigger invalid and disabled when asked", () => {
    const html = render("", { invalid: true, disabled: true });

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("disabled");
  });
});
