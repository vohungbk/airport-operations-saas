import type { Decision } from "@/lib/release/unresolved-decisions";
import { JOURNEY_ROLES, type Journey } from "@/lib/release/journeys";

/**
 * The release readiness report (VI-F08-S08, spec R8): what a release holds and what is
 * still open, in one place, for the people who decide. Pure: the run that reads the
 * repo is src/lib/release/release-readiness.report.ts. The report states facts. It
 * makes no judgement on readiness: who signs it off is not decided (spec Q4).
 */

export interface GateRow {
  name: string;
  command: string;
  exit: string;
  result: string;
}

export interface GatesReport {
  commit: string;
  /** The gates ran on a tree with uncommitted changes. */
  dirty: boolean;
  runAt: string;
  gates: GateRow[];
}

/** Pure. The result of `npm run release:gates`, read from the report it wrote; `null` when it is not one. */
export function parseGatesReport(markdown: string): GatesReport | null {
  const commit = /^- Commit: (\S+)( \(with uncommitted changes\))?/m.exec(markdown);
  const runAt = /^- Run at: (.+)$/m.exec(markdown);
  const gates = [...markdown.matchAll(/^\| (\w+) \| `([^`]+)` \| (\S+) \| (Pass|Fail|Not run) \|$/gm)].map(
    (m): GateRow => ({ name: m[1], command: m[2], exit: m[3], result: m[4] }),
  );

  if (!commit || gates.length === 0) return null;

  return { commit: commit[1], dirty: Boolean(commit[2]), runAt: runAt?.[1] ?? "unknown", gates };
}

/** Pure. The `key = value` lines of a section of a TOML file, comments cut. */
export function readTomlSection(toml: string, section: string): Record<string, string> {
  const lines = toml.split("\n");
  const start = lines.findIndex((line) => line.trim() === `[${section}]`);
  if (start === -1) return {};

  const values: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (/^\s*\[/.test(line)) break;
    const match = /^\s*([a-z_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/\s+#.*$/, "");
  }
  return values;
}

/** The settings of the Supabase project that the app depends on, from supabase/config.toml. */
export const AUTH_SETTINGS: readonly { section: string; key: string }[] = [
  { section: "auth", key: "site_url" },
  { section: "auth", key: "additional_redirect_urls" },
  { section: "auth", key: "jwt_expiry" },
  { section: "auth", key: "enable_signup" },
  { section: "auth", key: "minimum_password_length" },
  { section: "auth.email", key: "enable_signup" },
  { section: "auth.email", key: "enable_confirmations" },
];

/** Pure. The names (never the values) of the public variables the app reads from its settings. */
export function parseSettingNames(source: string): string[] {
  return [...new Set(source.match(/\bNEXT_PUBLIC_[A-Z0-9_]+\b/g) ?? [])].sort();
}

const MIGRATION_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

/** Pure. What is wrong with the migration file names: a name off the pattern, a repeated timestamp. */
export function checkMigrations(names: readonly string[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    if (!MIGRATION_NAME.test(name)) {
      problems.push(`${name}: the name is not <14-digit timestamp>_<name>.sql`);
      continue;
    }
    const stamp = name.slice(0, 14);
    if (seen.has(stamp)) problems.push(`${name}: the timestamp ${stamp} is used by another migration`);
    seen.add(stamp);
  }

  return problems;
}

export interface ReadinessInput {
  generatedAt: string;
  commit: string;
  /** The tree has uncommitted changes. */
  dirty: boolean;
  gates: GatesReport | null;
  /** File names under supabase/migrations. */
  migrations: readonly string[];
  /** Names of the variables the app reads. */
  variableNames: readonly string[];
  /** Values read from supabase/config.toml, by `section.key`. */
  authSettings: Readonly<Record<string, string>>;
  /** The text of docs/known-limitations.md. */
  limitations: string;
  decisions: readonly Decision[];
  /** Entries of the decisions register that were not valid, and why. */
  rejectedDecisions: readonly { id: string; issues: string[] }[];
  journeys: readonly Journey[];
  journeyGaps: readonly string[];
}

function gatesSection(input: ReadinessInput): string[] {
  const { gates } = input;
  if (!gates) {
    return [
      "The gates have not been run: there is no result of `npm run release:gates`. Run it, then run this report again.",
    ];
  }

  const sameCommit = gates.commit === input.commit && !gates.dirty && !input.dirty;

  return [
    sameCommit
      ? `The gates were run for this commit (${gates.commit}) on a clean tree, at ${gates.runAt}.`
      : `**The gates were not run for this commit.** The last run was for ${gates.commit}${gates.dirty ? " with uncommitted changes" : ""}, at ${gates.runAt}; this report is for ${input.commit}${input.dirty ? " with uncommitted changes" : ""}. Run \`npm run release:gates\` on a clean tree, then run this report again.`,
    "",
    "| Gate | Command | Exit code | Result |",
    "|---|---|---|---|",
    ...gates.gates.map((g) => `| ${g.name} | \`${g.command}\` | ${g.exit} | ${g.result} |`),
  ];
}

/** Pure. The report. */
export function buildReadinessReport(input: ReadinessInput): string {
  const open = input.decisions.filter((d) => d.status === "open");
  const decided = input.decisions.filter((d) => d.status === "decided");
  const migrationProblems = checkMigrations(input.migrations);
  const sorted = [...input.migrations].sort();

  const lines: string[] = [
    "# Release readiness",
    "",
    `- Generated at: ${input.generatedAt}`,
    `- Commit: ${input.commit}${input.dirty ? " (with uncommitted changes)" : ""}`,
    "",
    "This report states facts for the people who decide. It makes no judgement on readiness: who signs it off is not decided (spec Q4), and no sign-off is recorded.",
    "",
    "## 1. Build gates",
    "",
    ...gatesSection(input),
    "",
    "## 2. Migrations",
    "",
    `${input.migrations.length} migrations in \`supabase/migrations\`, applied in the order of their file names.`,
    ...(sorted.length > 0 ? [`First: \`${sorted[0]}\`. Last: \`${sorted[sorted.length - 1]}\`.`] : []),
    ...(migrationProblems.length > 0 ? ["", "Problems with the names:", ...migrationProblems.map((p) => `- ${p}`)] : []),
    "",
    ...sorted.map((name) => `- ${name}`),
    "",
    "## 3. Configuration of the environment",
    "",
    "Variables the app reads (names only; set them in the environment of the release, never in the code):",
    "",
    ...(input.variableNames.length > 0 ? input.variableNames.map((name) => `- \`${name}\``) : ["- none found"]),
    "",
    "Settings of the Supabase project that the app depends on. The values below are the local ones from `supabase/config.toml`; set the equivalent in the project of the release:",
    "",
    "| Setting | Local value |",
    "|---|---|",
    ...AUTH_SETTINGS.map(
      ({ section, key }) => `| \`[${section}] ${key}\` | ${input.authSettings[`${section}.${key}`] ?? "not set"} |`,
    ),
    "",
    "The demo seed loads into a local database only; do not load it into a database of the release.",
    "",
    "## 4. Known limitations",
    "",
    input.limitations.trim() === "" ? "None are written down." : input.limitations.replace(/^## Known limitations\s*/m, "").replace(/^## /gm, "### ").trim(),
    "",
    "## 5. Unresolved decisions",
    "",
    open.length === 0 ? "None are open." : `${open.length} open.`,
    "",
    ...(open.length > 0
      ? [
          "| Id | Question | What it means for the release | Source |",
          "|---|---|---|---|",
          ...open.map((d) => `| ${d.id} | ${d.question} | ${d.effect} | ${d.source} |`),
        ]
      : []),
    ...(decided.length > 0
      ? [
          "",
          "Decided:",
          "",
          ...decided.flatMap((d) => (d.status === "decided" ? [`- ${d.id}: ${d.decision} (${d.decided_by}, ${d.decided_on})`] : [])),
        ]
      : []),
    ...(input.rejectedDecisions.length > 0
      ? [
          "",
          "Entries of the register that are not complete, so they are not counted as decided:",
          ...input.rejectedDecisions.map((r) => `- ${r.id}: ${r.issues.join("; ")}`),
        ]
      : []),
    "",
    "## 6. Regression coverage",
    "",
    "The regression suite is `npm test`, the tests gate. A change that breaks a journey below fails a test there before the release.",
    "",
    "| Role | Journeys with a test |",
    "|---|---|",
    ...JOURNEY_ROLES.map((role) => `| ${role} | ${input.journeys.filter((j) => j.roles.includes(role)).length} |`),
    "",
    input.journeyGaps.length === 0
      ? `All ${input.journeys.length} journeys name a test that is still there.`
      : ["Journeys with a gap:", ...input.journeyGaps.map((g) => `- ${g}`)].join("\n"),
    "",
    "## 7. Sign-off",
    "",
    "Not recorded. Who signs off release readiness is an open decision (spec Q4).",
  ];

  return `${lines.join("\n")}\n`;
}
