import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("The step screens on a poor network (UI-F07-S04)", () => {
  const SCREENS = [
    "src/features/installations/components/installation-form.tsx",
    "src/features/cleaning/components/cleaning-start-panel.tsx",
    "src/features/cleaning/components/cleaning-complete-form.tsx",
    "src/features/inspections/components/inspection-form.tsx",
  ];

  it.each(SCREENS)("should show the offline banner and let %s retry", (file) => {
    const source = read(file);

    expect(source.match(/<OfflineBanner \/>/g)).toHaveLength(1);
    expect(source).toContain("onRetry=");
  });

  const DRAFT_HOOKS: [string, string][] = [
    ["src/features/installations/hooks/use-record-installation-form.ts", '"installation"'],
    ["src/features/cleaning/hooks/use-complete-cleaning-form.ts", '"cleaning"'],
    ["src/features/inspections/hooks/use-record-inspection-form.ts", '"inspection"'],
  ];

  it.each(DRAFT_HOOKS)("should keep the draft of the form in %s", (file, step) => {
    expect(read(file)).toContain(`useStepDraft(form, ${step}, jobId, DRAFT_FIELDS)`);
  });

  const DRAFT_FORMS = SCREENS.filter((file) => !file.includes("start-panel"));

  it.each(DRAFT_FORMS)("should drop the draft when Cancel is pressed in %s", (file) => {
    expect(read(file)).toContain("onClick={discardDraft}");
  });

  it("should drop the draft on the success screen of a step", () => {
    expect(read("src/features/jobs/components/step-done.tsx")).toContain(
      "<ClearStepDraft step={done.step} jobId={done.job_id} />",
    );
  });
});
