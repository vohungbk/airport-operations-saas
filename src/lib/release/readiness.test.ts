import { describe, expect, it } from "vitest";

import { JOURNEYS } from "@/lib/release/journeys";
import {
  buildReadinessReport,
  checkMigrations,
  parseGatesReport,
  parseSettingNames,
  readTomlSection,
  type GatesReport,
  type ReadinessInput,
} from "@/lib/release/readiness";
import { DECISIONS, type Decision } from "@/lib/release/unresolved-decisions";

/**
 * VI-F08-S08 (spec R8): the release readiness report holds the migrations, the
 * configuration of the environment, the known limitations and the unresolved
 * decisions. It states facts and never judges readiness, and it never shows the
 * value of a variable of the environment.
 */
const GATES_MD = `# Release gates

- Run at: 2026-10-22 12:00 UTC
- Commit: abc1234

| Gate | Command | Exit code | Result |
|---|---|---|---|
| typecheck | \`npm run typecheck\` | 0 | Pass |
| lint | \`npm run lint\` | 0 | Pass |
| tests | \`npm run test\` | - | Not run |
| build | \`npm run build\` | 1 | Fail |
`;

const gates = (over: Partial<GatesReport> = {}): GatesReport => ({
  ...(parseGatesReport(GATES_MD) as GatesReport),
  ...over,
});

const input = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  generatedAt: "2026-10-22 12:30 UTC",
  commit: "abc1234",
  dirty: false,
  gates: gates(),
  migrations: ["20260826083733_create_enums_and_extensions.sql", "20260826083744_create_partners_table.sql"],
  variableNames: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
  authSettings: { "auth.site_url": '"http://127.0.0.1:3000"', "auth.email.enable_confirmations": "false" },
  limitations: "## Known limitations\n\n- One thing is not checked.\n",
  decisions: DECISIONS,
  rejectedDecisions: [],
  journeys: JOURNEYS,
  journeyGaps: [],
  ...over,
});

describe("parseGatesReport", () => {
  it("should read the commit, the time and every gate of the report of the release gates", () => {
    expect(parseGatesReport(GATES_MD)).toEqual({
      commit: "abc1234",
      dirty: false,
      runAt: "2026-10-22 12:00 UTC",
      gates: [
        { name: "typecheck", command: "npm run typecheck", exit: "0", result: "Pass" },
        { name: "lint", command: "npm run lint", exit: "0", result: "Pass" },
        { name: "tests", command: "npm run test", exit: "-", result: "Not run" },
        { name: "build", command: "npm run build", exit: "1", result: "Fail" },
      ],
    });
  });

  it("should know that the gates ran on a tree with uncommitted changes", () => {
    expect(parseGatesReport(GATES_MD.replace("abc1234", "abc1234 (with uncommitted changes)"))?.dirty).toBe(true);
  });

  it("should give nothing for a text that is not that report", () => {
    expect(parseGatesReport("# Something else")).toBeNull();
  });
});

describe("readTomlSection and parseSettingNames", () => {
  const toml = `[auth]\nsite_url = "http://127.0.0.1:3000"\njwt_expiry = 3600 # one hour\n\n[auth.email]\nenable_confirmations = false\n[other]\nsite_url = "no"\n`;

  it("should read the keys of a section, with comments cut, and stop at the next section", () => {
    expect(readTomlSection(toml, "auth")).toEqual({ site_url: '"http://127.0.0.1:3000"', jwt_expiry: "3600" });
    expect(readTomlSection(toml, "auth.email")).toEqual({ enable_confirmations: "false" });
  });

  it("should give nothing for a section that is not there", () => {
    expect(readTomlSection(toml, "missing")).toEqual({});
  });

  it("should find the names of the public variables once each, and not any value", () => {
    const source = 'const a = process.env.NEXT_PUBLIC_SUPABASE_URL; const b = "NEXT_PUBLIC_SUPABASE_URL"; const c = process.env.NEXT_PUBLIC_X;';

    expect(parseSettingNames(source)).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_X"]);
  });
});

describe("checkMigrations", () => {
  it("should accept names that follow the pattern, with different timestamps", () => {
    expect(checkMigrations(["20260826083733_create_a.sql", "20260826083744_create_b.sql"])).toEqual([]);
  });

  it("should report a name off the pattern and a repeated timestamp", () => {
    const problems = checkMigrations(["20260826083733_a.sql", "20260826083733_b.sql", "notes.sql"]);

    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("20260826083733_b.sql");
    expect(problems[1]).toContain("notes.sql");
  });
});

describe("buildReadinessReport (spec R8, AC01)", () => {
  it("should hold the migrations, the configuration of the environment, the limitations and the unresolved decisions", () => {
    const text = buildReadinessReport(input());

    expect(text).toContain("## 2. Migrations");
    expect(text).toContain("2 migrations");
    expect(text).toContain("20260826083733_create_enums_and_extensions.sql");
    expect(text).toContain("## 3. Configuration of the environment");
    expect(text).toContain("`NEXT_PUBLIC_SUPABASE_URL`");
    expect(text).toContain("| `[auth] site_url` | \"http://127.0.0.1:3000\" |");
    expect(text).toContain("| `[auth] jwt_expiry` | not set |");
    expect(text).toContain("## 4. Known limitations");
    expect(text).toContain("One thing is not checked.");
    expect(text).not.toContain("### Known limitations");
    expect(text).toContain("## 5. Unresolved decisions");
    expect(text).toContain(`${DECISIONS.length} open.`);
    expect(text).toContain("VI-F08-Q1");
  });

  it("should never say that the release is ready, and say that nothing is signed off", () => {
    const text = buildReadinessReport(input());

    expect(text).not.toMatch(/release ready|ready for release|is ready|are ready/i);
    expect(text).toContain("Not recorded. Who signs off release readiness is an open decision (spec Q4).");
  });

  it("should show the names of the variables and never a value", () => {
    const text = buildReadinessReport(input({ variableNames: ["NEXT_PUBLIC_SUPABASE_URL"] }));

    expect(text).toContain("`NEXT_PUBLIC_SUPABASE_URL`");
    expect(text).not.toMatch(/NEXT_PUBLIC_SUPABASE_URL\s*=/);
  });

  it("should say the gates were run for this commit when the commit is the same and the trees are clean", () => {
    expect(buildReadinessReport(input())).toContain("The gates were run for this commit (abc1234) on a clean tree");
  });

  it.each([
    ["the gates ran for another commit", { gates: gates({ commit: "def5678" }) }],
    ["the gates ran on a tree with uncommitted changes", { gates: gates({ dirty: true }) }],
    ["this tree has uncommitted changes", { dirty: true }],
  ])("should say the gates were not run for this commit when %s", (_name, over) => {
    const text = buildReadinessReport(input(over as Partial<ReadinessInput>));

    expect(text).toContain("**The gates were not run for this commit.**");
    expect(text).not.toContain("The gates were run for this commit");
  });

  it("should say the gates have not been run when there is no result", () => {
    expect(buildReadinessReport(input({ gates: null }))).toContain("The gates have not been run");
  });

  it("should write the result of each gate as it was, with a failure and a gate not run", () => {
    const text = buildReadinessReport(input());

    expect(text).toContain("| build | `npm run build` | 1 | Fail |");
    expect(text).toContain("| tests | `npm run test` | - | Not run |");
  });

  it("should list a decided decision with who decided it, and not as open", () => {
    const decided: Decision = {
      id: "D-1",
      source: "A spec",
      question: "Which?",
      effect: "None",
      status: "decided",
      decision: "The first.",
      decided_by: "Product owner",
      decided_on: "2026-11-01",
    };
    const text = buildReadinessReport(input({ decisions: [decided] }));

    expect(text).toContain("None are open.");
    expect(text).toContain("- D-1: The first. (Product owner, 2026-11-01)");
  });

  it("should say which entries of the register are not complete, and not count them as decided", () => {
    const text = buildReadinessReport(
      input({ decisions: [], rejectedDecisions: [{ id: "D-2", issues: ["decided_by: Too small"] }] }),
    );

    expect(text).toContain("not counted as decided");
    expect(text).toContain("- D-2: decided_by: Too small");
  });

  it("should report a journey with a gap, and the number of journeys of each role", () => {
    const text = buildReadinessReport(input({ journeyGaps: ["J01: \"bookings (F11)\" is no longer in a.test.ts"] }));

    expect(text).toContain("Journeys with a gap:");
    expect(text).toContain("- J01:");
    expect(text).toMatch(/\| technician \| \d+ \|/);
  });

  it("should state that a clean register of journeys names tests that are still there", () => {
    expect(buildReadinessReport(input())).toContain(`All ${JOURNEYS.length} journeys name a test that is still there.`);
  });

  it("should say so when the migrations have a name off the pattern", () => {
    const text = buildReadinessReport(input({ migrations: ["notes.sql"] }));

    expect(text).toContain("Problems with the names:");
    expect(text).toContain("notes.sql");
  });
});
