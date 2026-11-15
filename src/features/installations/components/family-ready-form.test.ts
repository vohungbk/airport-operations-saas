import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/installations/hooks/use-mark-family-ready", () => ({
  useMarkFamilyReady: hookMock,
}));

import { FamilyReadyForm } from "@/features/installations/components/family-ready-form";

function render(props: { vehicle: string | null; bay: string | null }) {
  return renderToStaticMarkup(
    createElement(FamilyReadyForm, {
      jobId: "j-1",
      jobNumber: "JOB-2026-0081",
      bookingNumber: "BK-2026-000123",
      timeZone: "Asia/Dubai",
      installedLine: "Omar Haddad · 24 Oct 2026 · 14:18 GST",
      ...props,
    }),
  );
}

describe("FamilyReadyForm", () => {
  beforeEach(() => {
    hookMock.mockReturnValue({
      checked: [],
      toggle: vi.fn(),
      submit: vi.fn(),
      isPending: false,
      result: null,
      canSubmit: false,
    });
  });

  it("should show the banner, the three confirmations, the vehicle and the bay", () => {
    const html = render({ vehicle: "Toyota RAV4 · DXB A 48291", bay: "Terminal 3 · C-14" });

    expect(html).toContain("Installation completed");
    expect(html).toContain("Omar Haddad · 24 Oct 2026 · 14:18 GST");
    expect(html).toContain("Keys and handover information are ready");
    expect(html).toContain("Toyota RAV4 · DXB A 48291");
    expect(html).toContain("Terminal 3 · C-14");
  });

  it("should keep the button off until every confirmation is checked", () => {
    expect(render({ vehicle: null, bay: null })).toMatch(
      /<button[^>]*\sdisabled=""[^>]*>Mark vehicle Family Ready</,
    );
  });

  it("should show a dash when the booking has no vehicle or bay", () => {
    expect(render({ vehicle: null, bay: null })).toContain("—");
  });
});
