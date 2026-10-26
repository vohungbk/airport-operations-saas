import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { FieldCounter } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MoneyInput, PercentInput, SearchInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";

const BUTTON_VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const BUTTON_SIZES = ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("Button", () => {
  it.each(BUTTON_VARIANTS)("should draw the %s variant", (variant) => {
    const markup = html(createElement(Button, { variant }, "Save"));

    expect(markup).toContain('data-slot="button"');
    expect(markup).toContain("Save");
  });

  it.each(BUTTON_SIZES)("should draw the %s size", (size) => {
    expect(html(createElement(Button, { size }, "Save"))).toContain('data-slot="button"');
  });

  it("should disable a loading button, mark it busy and keep its label", () => {
    const markup = html(createElement(Button, { loading: true }, "Save"));

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("animate-spin");
    expect(markup).toContain("Save");
  });

  it("should show a spinner only while loading", () => {
    expect(html(createElement(Button, null, "Save"))).not.toContain("animate-spin");
    expect(html(createElement(Button, null, "Save"))).not.toContain('aria-busy="');
  });

  it("should hide the spinner from assistive technology", () => {
    expect(html(createElement(Button, { loading: true }, "Save"))).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("should stay disabled when asked to, even when it is not loading", () => {
    expect(html(createElement(Button, { disabled: true }, "Save"))).toContain("disabled");
  });

  it("should let a long label wrap and keep the button inside its box", () => {
    const markup = html(createElement(Button, null, "A very long label"));

    expect(markup).toContain("max-w-full");
    expect(markup).toContain("min-h-8");
    expect(markup).not.toContain("whitespace-nowrap");
  });
});

describe("Input", () => {
  it("should be 32 px high", () => {
    expect(html(createElement(Input, null))).toContain("h-8");
  });

  it("should cut a long value with an ellipsis and keep it whole in the title", () => {
    const markup = html(createElement(Input, { value: "SEAT-0001-very-long", onChange: () => {} }));

    expect(markup).toContain("text-ellipsis");
    expect(markup).toContain('title="SEAT-0001-very-long"');
  });

  it("should never put the value of a password in the title", () => {
    expect(html(createElement(Input, { type: "password", defaultValue: "secret-value" }))).not.toContain("title=");
    expect(html(createElement(Input, { type: "password", value: "secret-value", onChange: () => {} }))).not.toContain("title=");
  });

  it("should keep the first value of an input that is not controlled whole in the title too", () => {
    expect(html(createElement(Input, { defaultValue: "SEAT-0001-very-long" }))).toContain('title="SEAT-0001-very-long"');
  });

  it("should not invent a title when there is no value or when one is given", () => {
    expect(html(createElement(Input, null))).not.toContain("title=");
    expect(html(createElement(Input, { value: "abc", title: "Own title", onChange: () => {} }))).toContain(
      'title="Own title"',
    );
  });

  it("should mark an invalid input for assistive technology and style it", () => {
    const markup = html(createElement(Input, { "aria-invalid": true }));

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain("aria-invalid:border-destructive");
  });
});

describe("Textarea", () => {
  it("should be a textarea that grows with its text and wraps a long word", () => {
    const markup = html(createElement(Textarea, { defaultValue: "Notes" }));

    expect(markup).toContain("<textarea");
    expect(markup).toContain("field-sizing-content");
    expect(markup).toContain("break-words");
  });

  it("should support the disabled and invalid states", () => {
    const markup = html(createElement(Textarea, { disabled: true, "aria-invalid": true }));

    expect(markup).toContain("disabled");
    expect(markup).toContain('aria-invalid="true"');
  });
});

describe("input with a sign inside", () => {
  it("should put the currency sign in front of the amount and hide it from assistive technology", () => {
    const markup = html(createElement(MoneyInput, { "aria-label": "Amount" }));

    expect(markup).toContain('data-start="true"');
    expect(markup).toMatch(/<span aria-hidden="true"[^>]*>\$<\/span>/);
    expect(markup).toContain('inputMode="decimal"');
  });

  it("should take another currency sign", () => {
    expect(html(createElement(MoneyInput, { currency: "AED", "aria-label": "Amount" }))).toContain(">AED<");
  });

  it("should put % after a percentage", () => {
    const markup = html(createElement(PercentInput, { "aria-label": "Share" }));

    expect(markup).toContain('data-end="true"');
    expect(markup).toMatch(/<span aria-hidden="true"[^>]*>%<\/span>/);
  });

  it("should draw a search box with a magnifier and the search keyboard", () => {
    const markup = html(createElement(SearchInput, { "aria-label": "Search seats" }));

    expect(markup).toContain('type="search"');
    expect(markup).toContain('data-start="true"');
    expect(markup).toContain("<svg");
  });

  it("should leave room for the sign only when there is one", () => {
    expect(html(createElement(Input, null))).not.toContain("data-start");
  });
});

describe("FieldCounter", () => {
  it("should show the count against the limit and stay quiet for a screen reader while it is within it", () => {
    const markup = html(createElement(FieldCounter, { value: "abc", max: 10 }));

    expect(markup).toContain(">3 / 10<");
    expect(markup).toContain('aria-live="off"');
    expect(markup).not.toContain("data-over");
  });

  it("should be marked, and read out politely, when the value is over the limit", () => {
    const markup = html(createElement(FieldCounter, { value: "abcdef", max: 5 }));

    expect(markup).toContain('data-over="true"');
    expect(markup).toContain('aria-live="polite"');
  });
});
