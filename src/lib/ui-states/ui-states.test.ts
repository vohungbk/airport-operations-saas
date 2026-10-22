import { describe, expect, it } from "vitest";

import {
  applyExceptions,
  fetchesData,
  findStateGaps,
  handlesMissingRecord,
  hasEmptyState,
  isListPage,
  readApp,
  type AppPage,
  type StateException,
} from "@/lib/ui-states/audit";

/**
 * VI-F08-S07 (spec R7): loading, empty, error, permission and not-found states
 * exist where relevant. A page that reads data has a loading and an error state of
 * its own segment; a page with an id in its address handles a record that is
 * missing or hidden; a page with a table says what it shows when it is empty. A
 * page that lacks one fails the check, unless it is listed here with the reason.
 * The permission state is the /forbidden page, and every protected page reaches it
 * through the guards that src/lib/security checks. How the states look is in
 * docs/ui-states-review.md.
 */
const EXCEPTIONS: StateException[] = [
  {
    id: "loading:forbidden/page.tsx",
    reason:
      "The landing page for a person who is not allowed. It reads only the session (no database call) and must never wait on anything; a loading state could hide where a redirect lands.",
  },
  {
    id: "error:forbidden/page.tsx",
    reason:
      "It reads only the session claims. A failure there is caught by the error boundary of the app root, which offers a retry.",
  },
  {
    id: "loading:(auth)/reset-password/page.tsx",
    reason: "It reads only the session claims to tell a valid reset link from an expired one: no database call.",
  },
  {
    id: "error:(auth)/reset-password/page.tsx",
    reason: "It reads only the session claims. A failure there is caught by the error boundary of the app root.",
  },
];

describe("the states of every page of the app (spec R7)", () => {
  const { pages, files } = readApp();
  const { blocked, problems } = applyExceptions(findStateGaps(pages, files), EXCEPTIONS);

  it("should find the pages it is meant to check", () => {
    expect(pages.length).toBeGreaterThan(35);
    expect(pages.filter((p) => fetchesData(p.source)).length).toBeGreaterThan(25);
    expect(pages.filter((p) => isListPage(p.source)).length).toBeGreaterThanOrEqual(8);
  });

  it("should leave no page without the loading, error, not-found or empty state it needs, unless listed with a reason", () => {
    expect(blocked.map((gap) => gap.message)).toEqual([]);
  });

  it("should list only exceptions that have a reason and are still needed", () => {
    expect(problems).toEqual([]);
  });
});

describe("findStateGaps", () => {
  const page = (file: string, source: string): AppPage => ({ file, source });
  const withFiles = (...names: string[]) => new Set(names);
  const DATA = "const rows = await getRows();";

  it("should find no gap when a data page has its loading and error states", () => {
    const gaps = findStateGaps(
      [page("(admin)/seats/page.tsx", DATA)],
      withFiles("(admin)/seats/loading.tsx", "(admin)/seats/error.tsx"),
    );

    expect(gaps).toEqual([]);
  });

  it("should find a data page with no loading state of its segment, and no error state", () => {
    const gaps = findStateGaps([page("(admin)/seats/page.tsx", DATA)], withFiles());

    expect(gaps.map((g) => g.id)).toEqual(["loading:(admin)/seats/page.tsx", "error:(admin)/seats/page.tsx"]);
  });

  it("should take the boundary of a segment above, for a page below it", () => {
    const gaps = findStateGaps(
      [page("(admin)/seats/[id]/edit/page.tsx", `${DATA} notFound();`)],
      withFiles("(admin)/seats/loading.tsx", "(admin)/seats/error.tsx"),
    );

    expect(gaps).toEqual([]);
  });

  it("should not take the boundary of the app root for a page of its own, since a segment needs its own", () => {
    const gaps = findStateGaps([page("(admin)/seats/page.tsx", DATA)], withFiles("loading.tsx", "error.tsx"));

    expect(gaps).toHaveLength(2);
  });

  it("should not ask a page that reads no data for a loading state", () => {
    expect(findStateGaps([page("(auth)/login/page.tsx", "export default function P() {}")], withFiles())).toEqual([]);
  });

  it("should find a page with an id that has no state for a missing record", () => {
    const gaps = findStateGaps(
      [page("(admin)/seats/[id]/page.tsx", "export default function P() {}")],
      withFiles(),
    );

    expect(gaps.map((g) => g.id)).toEqual(["not-found:(admin)/seats/[id]/page.tsx"]);
  });

  it.each([["notFound();"], ["<PageNotFound />"], ["<PageForbidden />"], ["This incident was not found."], ["You cannot view it"]])(
    "should accept a page with an id that handles a missing record: %s",
    (source) => {
      expect(handlesMissingRecord(source)).toBe(true);
    },
  );

  it("should find a page with a table and no message for when it is empty", () => {
    const source = "export default function P() { return <SeatsTable rows={[]} />; }";

    expect(isListPage(source)).toBe(true);
    expect(hasEmptyState(source)).toBe(false);
    expect(findStateGaps([page("(admin)/seats/page.tsx", source)], withFiles()).map((g) => g.id)).toEqual([
      "empty:(admin)/seats/page.tsx",
    ]);
  });

  it("should accept a page with a table that has an empty state", () => {
    const source = "<SeatsTable /> <PageEmpty message='none' />";

    expect(findStateGaps([page("(admin)/seats/page.tsx", source)], withFiles())).toEqual([]);
  });
});

describe("applyExceptions", () => {
  const gap = { id: "loading:a/page.tsx", message: "a/page.tsx: no loading" };

  it("should block a gap that no exception explains", () => {
    expect(applyExceptions([gap], []).blocked).toEqual([gap]);
  });

  it("should let a gap through when an exception gives the reason", () => {
    expect(applyExceptions([gap], [{ id: gap.id, reason: "Reads only the session." }])).toEqual({
      blocked: [],
      problems: [],
    });
  });

  it("should not let a gap through on an exception with no reason", () => {
    const result = applyExceptions([gap], [{ id: gap.id, reason: "  " }]);

    expect(result.blocked).toEqual([gap]);
    expect(result.problems).toEqual([`${gap.id}: no reason`]);
  });

  it("should report an exception whose page has the state now", () => {
    expect(applyExceptions([], [{ id: gap.id, reason: "Reads only the session." }]).problems).toEqual([
      `${gap.id}: stale, the page has the state now: remove it`,
    ]);
  });
});
