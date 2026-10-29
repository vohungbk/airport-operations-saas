import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearStepDraft,
  pickDraft,
  readStepDraft,
  stepDraftKey,
  writeStepDraft,
} from "@/features/jobs/lib/step-draft";

function stubStorage(store: Record<string, string> = {}) {
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });

  return store;
}

describe("step draft", () => {
  beforeEach(() => {
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should name the draft after the step and the job", () => {
    expect(stepDraftKey("cleaning", "j-1")).toBe("step-draft:cleaning:j-1");
  });

  it("should keep only the named fields that are text", () => {
    expect(
      pickDraft({ notes: "dirty", result: 3, other: "x", job_id: "j-1" }, ["notes", "result"]),
    ).toEqual({ notes: "dirty" });
  });

  it("should give back what was written for the same step", () => {
    writeStepDraft("k", { notes: "a stain", result: "passed" });

    expect(readStepDraft("k", ["notes", "result"])).toEqual({
      notes: "a stain",
      result: "passed",
    });
  });

  it("should give back nothing after the draft is cleared", () => {
    writeStepDraft("k", { notes: "a stain" });
    clearStepDraft("k");

    expect(readStepDraft("k", ["notes"])).toEqual({});
  });

  it("should ignore a stored text that is not an object", () => {
    stubStorage({ k: "not json" });
    expect(readStepDraft("k", ["notes"])).toEqual({});

    stubStorage({ k: "42" });
    expect(readStepDraft("k", ["notes"])).toEqual({});
  });

  it("should not fail when the storage is blocked", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): never {
        throw new Error("blocked");
      },
    });

    expect(() => writeStepDraft("k", { notes: "x" })).not.toThrow();
    expect(() => clearStepDraft("k")).not.toThrow();
    expect(readStepDraft("k", ["notes"])).toEqual({});
  });
});
