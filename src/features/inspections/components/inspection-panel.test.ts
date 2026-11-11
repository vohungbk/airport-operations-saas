import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/inspections/hooks/use-inspection-panel", () => ({
  useInspectionPanel: hookMock,
}));

// A real Controller needs a form instance and a Dialog renders in a portal; both are replaced by plain
// pass-through markup so the static render shows what the user would read.
vi.mock("react-hook-form", () => ({
  Controller: ({
    render,
  }: {
    render: (args: { field: { value: undefined; onChange: () => void } }) => unknown;
  }) => render({ field: { value: undefined, onChange: () => undefined } }),
}));

vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});

import { InspectionDiscardDialog } from "@/features/inspections/components/inspection-discard-dialog";
import { InspectionHistory } from "@/features/inspections/components/inspection-history";
import { InspectionPanel } from "@/features/inspections/components/inspection-panel";

function hookState(overrides: Record<string, unknown> = {}) {
  return {
    form: {
      register: () => ({}),
      control: {},
      formState: { errors: {} },
    },
    onSubmit: vi.fn(),
    isPending: false,
    result: null,
    viewRecordedInspection: vi.fn(),
    discardOpen: false,
    setDiscardOpen: vi.fn(),
    onCancel: vi.fn(),
    onDiscard: vi.fn(),
    notesRequired: false,
    notesLength: 0,
    ...overrides,
  };
}

function render() {
  return renderToStaticMarkup(
    createElement(InspectionPanel, { jobId: "j-1", seatId: "s-1", seatLabel: "SEAT-0001" }),
  );
}

describe("InspectionPanel", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show the read only seat, the result select, optional notes and Save and Cancel", () => {
    hookMock.mockReturnValue(hookState());

    const html = render();

    expect(html).toContain("SEAT-0001");
    expect(html).toContain("Read only");
    expect(html).toContain("Select result");
    expect(html).toContain("Inspection notes (optional)");
    expect(html).toContain("0 / 1000");
    expect(html).toContain("Save");
    expect(html).toContain("Cancel");
  });

  it("should mark the notes as required for a conditional pass or fail", () => {
    hookMock.mockReturnValue(hookState({ notesRequired: true }));

    expect(render()).toContain("Inspection notes (required)");
  });

  it("should show the error that asks for notes next to the notes field", () => {
    hookMock.mockReturnValue(
      hookState({
        notesRequired: true,
        form: {
          register: () => ({}),
          control: {},
          formState: {
            errors: { notes: { message: "Add notes for a conditional pass or fail." } },
          },
        },
      }),
    );

    expect(render()).toContain("Add notes for a conditional pass or fail.");
  });

  it("should disable the fields and say the inspection is saving", () => {
    hookMock.mockReturnValue(hookState({ isPending: true }));

    const html = render();

    expect(html).toContain("Saving...");
    expect(html).toContain("Saving inspection. Fields are disabled.");
    expect(html).toMatch(/<textarea[^>]*disabled/);
  });

  it("should keep the touch targets at 44 px and the action bar above the bottom nav on a phone", () => {
    hookMock.mockReturnValue(hookState());

    const html = render();

    expect(html).toContain('data-slot="step-action-bar"');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*min-h-11/);
  });
});

describe("InspectionPanel errors", () => {
  it("should say the entry was not saved and offer the recorded inspection after a conflict (AC06)", () => {
    hookMock.mockReturnValue(
      hookState({
        result: { success: false, error: { code: "ALREADY_RECORDED", message: "raw" } },
      }),
    );

    const html = render();

    expect(html).toContain("Already recorded");
    expect(html).toContain("Your entry was not saved");
    expect(html).toContain("View the recorded inspection");
  });

  it("should keep the entry and tell the user to retry after a network failure", () => {
    hookMock.mockReturnValue(
      hookState({
        result: {
          success: false,
          error: { code: "NETWORK_ERROR", message: "Your input is kept; check your connection." },
        },
      }),
    );

    const html = render();

    expect(html).toContain("Unable to save inspection. Your changes are kept.");
    expect(html).toContain("Your input is kept");
    expect(html).toContain("Inspection notes");
  });
});

describe("InspectionDiscardDialog", () => {
  it("should ask to discard and offer to keep editing when open", () => {
    const html = renderToStaticMarkup(
      createElement(InspectionDiscardDialog, {
        open: true,
        onOpenChange: vi.fn(),
        onDiscard: vi.fn(),
      }),
    );

    expect(html).toContain("Discard this inspection?");
    expect(html).toContain("Keep editing");
    expect(html).toContain("Discard");
  });
});

describe("InspectionHistory", () => {
  it.each([
    ["pass", "Pass"],
    ["conditional_pass", "Conditional pass"],
    ["fail", "Fail"],
  ])("should show the result %s as text with an icon and no delete action", (result, label) => {
    const html = renderToStaticMarkup(
      createElement(InspectionHistory, {
        timeZone: "Asia/Dubai",
        items: [
          {
            id: "i-1",
            result,
            notes: "Checked",
            created_at: "2026-10-10T08:05:00Z",
            inspector: "Ahmed",
          } as never,
        ],
      }),
    );

    expect(html).toContain(label);
    expect(html).toContain("<svg");
    expect(html).not.toMatch(/<button[^>]*>\s*Delete/i);
  });

  it("should say no inspection is recorded when the list is empty", () => {
    const html = renderToStaticMarkup(
      createElement(InspectionHistory, { items: [], timeZone: "UTC" }),
    );

    expect(html).toContain("No inspection recorded yet.");
  });
});
