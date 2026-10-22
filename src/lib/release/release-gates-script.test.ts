import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * `npm run release:gates` (scripts/release-gates.sh, VI-F08-S01, spec R1) runs
 * typecheck, lint, tests and build, and records the result. It is run here with
 * stand-ins for `npm`, `npx` and `pgrep` that record what they are asked and
 * answer as we choose, so nothing is built and no database is touched.
 */
const SCRIPT = join(process.cwd(), "scripts", "release-gates.sh");

let dir: string;
let log: string;
let reports: string;

interface Setup {
  /** The gate whose npm command fails, e.g. "lint". */
  failing?: string;
  supabaseDown?: boolean;
  devServer?: boolean;
}

function run(setup: Setup = {}) {
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      RELEASE_GATES_REPORT_DIR: reports,
      FAKE_LOG: log,
      FAKE_FAILING: setup.failing ?? "",
      FAKE_SUPABASE: setup.supabaseDown ? "down" : "ok",
      FAKE_DEV: setup.devServer ? "1" : "",
    },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
  const reportFile = join(reports, "release-gates.md");

  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    calls,
    report: existsSync(reportFile) ? readFileSync(reportFile, "utf8") : null,
  };
}

function stub(name: string, lines: string[]) {
  const file = join(dir, name);
  writeFileSync(file, ["#!/usr/bin/env bash", ...lines, ""].join("\n"));
  chmodSync(file, 0o755);
}

describe("scripts/release-gates.sh (VI-F08-S01, spec R1)", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "release-gates-"));
    log = join(dir, "calls.log");
    reports = join(dir, "reports");
    writeFileSync(log, "");
    stub("npm", [
      'echo "npm $*" >> "$FAKE_LOG"',
      '[ "$1" = "run" ] && [ "$2" = "$FAKE_FAILING" ] && exit 1',
      "exit 0",
    ]);
    stub("npx", [
      'echo "npx $*" >> "$FAKE_LOG"',
      '[ "$FAKE_SUPABASE" = "down" ] && exit 1',
      "exit 0",
    ]);
    stub("pgrep", ['[ -n "$FAKE_DEV" ] && exit 0', "exit 1"]);
  });

  it("should run typecheck, lint, tests and build in that order, and pass when all four pass", () => {
    const { status, calls, report } = run();

    expect(status).toBe(0);
    expect(calls.filter((c) => c.startsWith("npm"))).toEqual([
      "npm run typecheck",
      "npm run lint",
      "npm run test",
      "npm run build",
    ]);
    expect(report).not.toBeNull();
    expect(report!.match(/\| Pass \|/g)).toHaveLength(4);
  });

  it("should record the time, the commit, the exit code of each gate and the known limitations", () => {
    const { report } = run();

    expect(report).toMatch(/Run at: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
    expect(report).toMatch(/Commit: [0-9a-f]{7,}/);
    expect(report).toContain("| typecheck | `npm run typecheck` | 0 | Pass |");
    expect(report).toContain("## Known limitations");
    expect(report).toContain("Open decisions of VI-F08");
  });

  it("should run the other gates, and fail, when lint fails", () => {
    const { status, calls, report, output } = run({ failing: "lint" });

    expect(status).toBe(1);
    expect(calls.filter((c) => c.startsWith("npm"))).toEqual([
      "npm run typecheck",
      "npm run lint",
      "npm run test",
      "npm run build",
    ]);
    expect(report).toContain("| lint | `npm run lint` | 1 | Fail |");
    expect(report).toContain("| build | `npm run build` | 0 | Pass |");
    expect(output).toContain("Not release ready");
  });

  it("should not run the tests, and fail, when the local Supabase stack is down: the integration tests would skip", () => {
    const { status, calls, report } = run({ supabaseDown: true });

    expect(status).toBe(1);
    expect(calls).not.toContain("npm run test");
    expect(report).toContain("| tests | `npm run test` | - | Not run |");
    expect(report).toContain("npx supabase start");
    expect(report).toContain("| build | `npm run build` | 0 | Pass |");
  });

  it("should refuse to start, and run nothing, while a dev server is running", () => {
    const { status, calls, output, report } = run({ devServer: true });

    expect(status).toBe(2);
    expect(output).toContain("dev server");
    expect(calls).toEqual([]);
    expect(report).toBeNull();
  });
});

describe("package.json", () => {
  const scripts = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).scripts;

  it("should have a typecheck script, so the typecheck is a gate like lint", () => {
    expect(scripts.typecheck).toBe("tsc --noEmit");
  });

  it("should run the release gates with one command", () => {
    expect(scripts["release:gates"]).toBe("bash scripts/release-gates.sh");
  });
});
