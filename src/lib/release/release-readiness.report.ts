import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { JOURNEYS, findJourneyGaps } from "@/lib/release/journeys";
import {
  AUTH_SETTINGS,
  buildReadinessReport,
  parseGatesReport,
  parseSettingNames,
  readTomlSection,
} from "@/lib/release/readiness";
import { DECISIONS, checkDecisions } from "@/lib/release/unresolved-decisions";

/**
 * VI-F08-S08 (spec R8): writes reports/release-readiness.md from the repo. Run it with
 * `npm run release:report` (see docs/release-readiness.md). It only reads: the repo, the
 * result of `npm run release:gates` and the registers of src/lib/release. It prints
 * the names of the variables of the environment, never their values.
 */
const root = process.cwd();
const read = (...path: string[]) => {
  const file = join(root, ...path);
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};

function git(command: string): string {
  try {
    return execSync(`git ${command}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

describe("the release readiness report (VI-F08-S08)", () => {
  it("should write the report of what the release holds and what is open", () => {
    const toml = read("supabase", "config.toml") ?? "";
    const authSettings: Record<string, string> = {};
    for (const { section, key } of AUTH_SETTINGS) {
      const value = readTomlSection(toml, section)[key];
      if (value !== undefined) authSettings[`${section}.${key}`] = value;
    }

    const { decisions, rejected } = checkDecisions(DECISIONS);
    const gatesMarkdown = read("reports", "release-gates.md");

    const report = buildReadinessReport({
      generatedAt: `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
      commit: git("rev-parse --short HEAD") || "unknown",
      dirty: git("status --porcelain") !== "",
      gates: gatesMarkdown ? parseGatesReport(gatesMarkdown) : null,
      migrations: readdirSync(join(root, "supabase", "migrations")).filter((name) => name.endsWith(".sql")),
      variableNames: parseSettingNames(read("src", "lib", "config", "env.ts") ?? ""),
      authSettings,
      limitations: read("docs", "known-limitations.md") ?? "",
      decisions,
      rejectedDecisions: rejected,
      journeys: JOURNEYS,
      journeyGaps: findJourneyGaps(JOURNEYS, (file) => read(file)),
    });

    mkdirSync(join(root, "reports"), { recursive: true });
    writeFileSync(join(root, "reports", "release-readiness.md"), report);
    console.log(`\n${report}\nWritten to reports/release-readiness.md`);

    expect(report).toContain("# Release readiness");
  });
});
