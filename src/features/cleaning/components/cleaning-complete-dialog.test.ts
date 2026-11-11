import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/cleaning/hooks/use-complete-cleaning-dialog", () => ({
  useCompleteCleaningDialog: hookMock,
}));
// The real dialog renders into a portal only when open; show its content directly.
vi.mock("@/components/ui/dialog", () => {
  const pass = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    Dialog: pass,
    DialogTrigger: pass,
    DialogContent: pass,
    DialogHeader: pass,
    DialogTitle: pass,
    DialogFooter: pass,
  };
});

import { CleaningCompleteDialog } from "@/features/cleaning/components/cleaning-complete-dialog";

interface State {
  result?: { success: boolean; error?: { code: string; message: string } } | null;
  isPending?: boolean;
  errors?: Record<string, { message: string }>;
  values?: Record<string, string>;
}

function useHookState({ result = null, isPending = false, errors = {}, values = {} }: State) {
  const form = useForm({ defaultValues: { job_id: "j-1", notes: "", ...values } });

  return {
    open: true,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn(),
    isPending,
    result,
    form: { ...form, formState: { errors } },
  };
}

function render(state: State) {
  hookMock.mockImplementation(() => useHookState(state));

  return renderToStaticMarkup(createElement(CleaningCompleteDialog, { jobId: "j-1", seatSerial: "SEAT-0001" }));
}

describe("CleaningCompleteDialog", () => {
  beforeEach(() => {
    hookMock.mockReset();
  });

  it("should show the result, the checklist, notes, the optional photo and Confirm", () => {
    const html = render({});

    expect(html).toContain("Completion checklist");
    for (const item of ["Cleaned", "Dried", "No damage"]) expect(html).toContain(item);
    expect(html).toContain("Photo (optional)");
    expect(html).toContain("Successful completion makes this seat Available");
    expect(html).toContain("Confirm");
  });

  it("should mark notes as required and ask for them when a failed result has none", () => {
    const html = render({
      values: { result: "failed" },
      errors: { notes: { message: "Add notes when cleaning fails" } },
    });

    expect(html).toContain("Notes *");
    expect(html).toContain('id="cleaning-notes-error"');
    expect(html).toContain("Add notes when cleaning fails");
  });

  it("should disable the fields and show Submitting while the save is running", () => {
    const html = render({ isPending: true });

    expect(html).toContain("Submitting...");
    expect(html).toContain("Saving cleaning record. Seat status changes only after confirmation.");
  });

  it("should show the error, keep the Failed result and offer Retry when the server fails", () => {
    const html = render({
      values: { result: "failed" },
      result: { success: false, error: { code: "NETWORK_ERROR", message: "No connection." } },
    });

    expect(html).toContain('value="failed"');
    expect(html).toContain("Could not save cleaning. Try again.");
    expect(html).toContain("Retry");
    expect(html).not.toContain(">Confirm<");
  });
});
