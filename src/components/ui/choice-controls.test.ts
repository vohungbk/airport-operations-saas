import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("Checkbox", () => {
  it("should render checked, unchecked and disabled states", () => {
    expect(html(createElement(Checkbox, { checked: true }))).toContain('aria-checked="true"');
    expect(html(createElement(Checkbox, { checked: false }))).toContain('aria-checked="false"');
    expect(html(createElement(Checkbox, { disabled: true }))).toContain("data-disabled");
  });

  it("should render the indeterminate state", () => {
    expect(html(createElement(Checkbox, { indeterminate: true }))).toContain("data-indeterminate");
  });

  it("should carry the invalid styling when aria-invalid is set", () => {
    const out = html(createElement(Checkbox, { "aria-invalid": true }));
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain("aria-invalid:border-destructive");
  });
});

describe("RadioGroup", () => {
  it("should check only the item whose value is selected", () => {
    const out = html(
      createElement(
        RadioGroup,
        { value: "a" },
        createElement(RadioGroupItem, { value: "a" }),
        createElement(RadioGroupItem, { value: "b" }),
      ),
    );
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/aria-checked="false"/g)).toHaveLength(1);
  });

  it("should let the group shrink in a narrow container", () => {
    expect(html(createElement(RadioGroup, null))).toContain("min-w-0");
  });
});

describe("Switch", () => {
  it("should render on and off states", () => {
    expect(html(createElement(Switch, { checked: true }))).toContain('aria-checked="true"');
    expect(html(createElement(Switch, { checked: false }))).toContain('aria-checked="false"');
  });

  it("should render the disabled state", () => {
    expect(html(createElement(Switch, { disabled: true }))).toContain("data-disabled");
  });
});

describe("SelectTrigger", () => {
  it("should be allowed to shrink inside a narrow container", () => {
    const out = html(createElement(Select, null, createElement(SelectTrigger, null, "x")));
    expect(out).toContain("max-w-full");
    expect(out).toContain("min-w-0");
  });
});

describe("Calendar", () => {
  it("should show the picked day as pressed and 42 day cells", () => {
    const out = html(createElement(Calendar, { value: "2026-11-18" }));
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(out.match(/aria-pressed=/g)).toHaveLength(42);
  });

  it("should disable the days outside min and max", () => {
    const out = html(createElement(Calendar, { value: "2026-11-18", min: "2026-11-10", max: "2026-11-20" }));
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="2026-11-09"/);
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="2026-11-15"/);
  });

  it("should not grow wider than its container", () => {
    expect(html(createElement(Calendar, null))).toContain("max-w-72");
  });
});

describe("DatePicker", () => {
  it("should show the placeholder when there is no value", () => {
    expect(html(createElement(DatePicker, { placeholder: "Pick a day" }))).toContain("Pick a day");
  });

  it("should show the picked day, cut with an ellipsis when it does not fit", () => {
    const out = html(createElement(DatePicker, { value: "2026-11-18" }));
    expect(out).toContain("2026-11-18");
    expect(out).toContain("truncate");
  });

  it("should render disabled", () => {
    expect(html(createElement(DatePicker, { disabled: true }))).toContain("disabled");
  });
});
