import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toaster } from "@/components/ui/toast";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("StatusBadge", () => {
  it("should show the text and a hidden icon", () => {
    const out = html(createElement(StatusBadge, { domain: "settlement", value: "pending_approval" }));
    expect(out).toContain("Pending approval");
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain("<svg");
  });

  it("should use the token pair of its variant", () => {
    const out = html(createElement(StatusBadge, { domain: "invoice", value: "overdue" }));
    expect(out).toContain("bg-danger-bg");
    expect(out).toContain("text-danger-fg");
  });

  it("should not crash on a value it does not know and should show it as text", () => {
    const out = html(createElement(StatusBadge, { domain: "flight", value: "teleported" }));
    expect(out).toContain("teleported");
    expect(out).toContain("bg-muted");
  });

  it("should cut a long label and keep it whole in the title", () => {
    const out = html(createElement(StatusBadge, { domain: "result", value: "conditional_pass" }));
    expect(out).toContain("truncate");
    expect(out).toContain('title="Conditional pass"');
  });
});

describe("Skeleton", () => {
  it("should be hidden from assistive technology", () => {
    expect(html(createElement(Skeleton, { className: "h-4 w-20" }))).toContain('aria-hidden="true"');
  });

  it("should stop pulsing when the user asks for less motion", () => {
    expect(html(createElement(Skeleton))).toContain("motion-reduce:animate-none");
  });
});

describe("Toaster", () => {
  it("should render an empty region when there is no toast", () => {
    const out = html(createElement(Toaster));
    expect(out).toContain('data-slot="toaster"');
    expect(out).not.toContain('data-slot="toast"');
  });
});
