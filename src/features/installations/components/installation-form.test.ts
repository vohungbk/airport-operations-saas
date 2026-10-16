import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/installations/hooks/use-record-installation-form", () => ({
  useRecordInstallationForm: hookMock,
}));

import { InstallationForm } from "@/features/installations/components/installation-form";

function hookState(result: unknown) {
  return {
    form: {
      register: () => ({}),
      formState: { errors: {} },
    },
    onSubmit: vi.fn(),
    isPending: false,
    result,
  };
}

function render() {
  return renderToStaticMarkup(
    createElement(InstallationForm, {
      jobId: "j-1",
      seatId: "s-1",
      seatLabel: "SN-1",
      timeZone: "Asia/Dubai",
      defaultInstalledAt: "2026-10-16T08:00",
    }),
  );
}

describe("InstallationForm", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show no error before the first submit", () => {
    hookMock.mockReturnValue(hookState(null));

    expect(render()).not.toContain("Could not record installation");
  });

  it("should point back to the jobs when the technician is not assigned any more", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "This job was not found or is no longer assigned to you.",
        },
      }),
    );

    const html = render();

    expect(html).toContain("This job is no longer available");
    expect(html).toContain('href="/jobs"');
  });

  it("should say access was lost when the database denies the insert", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to do this." },
      }),
    );

    const html = render();

    expect(html).toContain("You no longer have access to this action");
    expect(html).toContain('href="/jobs"');
  });

  it("should keep the form usable after a recoverable error", () => {
    hookMock.mockReturnValue(
      hookState({
        success: false,
        error: { code: "ALREADY_RECORDED", message: "An installation is already recorded for this job." },
      }),
    );

    const html = render();

    expect(html).toContain("Could not record installation");
    expect(html).not.toContain('href="/jobs"');
    expect(html).toContain("Installation time");
  });
});
