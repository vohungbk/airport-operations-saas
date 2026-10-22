import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import type { AcceptedRisk } from "@/lib/security/accepted-risks";

/**
 * VI-F08-S02 (spec R2, E1): what the security tests must cover, found by
 * reading the repo. Test support only; nothing in the app imports it.
 *
 * It proves that a test exists and that it speaks about a denial, not that the
 * test is strong enough: the RLS integration suite is the proof of isolation.
 */
const GUARD_PATTERN = /\brequire(Permission|AnyPermission|Role|PartnerScope)\(/g;

/** A test title that is about refusing someone. */
const DENIAL_TITLE =
  /forbidden|permission|denied|not allowed|unauthori|redirect|lacks|guard|reject|refus|blocked|no access|cannot/i;

export interface GuardedFile {
  file: string;
  /** The guards the file calls, e.g. `requirePermission`. */
  guards: string[];
  /** The text of the test next to it, or `null` when there is none. */
  testText: string | null;
}

export interface CoverageInput {
  /** Tables created in the migrations. */
  tables: string[];
  /** Tables whose migration enables row level security. */
  rlsTables: string[];
  /** The RLS integration suite. */
  rlsSuiteText: string;
  guarded: GuardedFile[];
  /** Every permission of the model. */
  permissions: string[];
  /** Permissions written as a literal in the app code, outside the model. */
  permissionsUsedInCode: string[];
  /** The text of the permission model's own test (the matrix). */
  matrixTestText: string;
  /** The text of every other test. */
  otherTestsText: string;
}

export interface Gap {
  /** What `ACCEPTED_RISKS` refers to. */
  id: string;
  message: string;
}

const hasWord = (text: string, word: string) =>
  new RegExp(`\\b${word}\\b`).test(text);

const titlesOf = (testText: string): string[] =>
  [...testText.matchAll(/\b(?:it|test)(?:\.each\([^)]*\))?\(\s*["'`]([^"'`]+)["'`]/g)].map(
    (m) => m[1],
  );

/** Pure. Everything that has no automated test for its security rule. */
export function findCoverageGaps(input: CoverageInput): Gap[] {
  const gaps: Gap[] = [];

  for (const table of input.tables) {
    if (!input.rlsTables.includes(table)) {
      gaps.push({ id: `table:${table}:rls`, message: `${table}: row level security is not enabled` });
    }
    if (!hasWord(input.rlsSuiteText, table)) {
      gaps.push({
        id: `table:${table}:suite`,
        message: `${table}: no test of the RLS integration suite names it`,
      });
    }
  }

  for (const { file, guards, testText } of input.guarded) {
    if (testText === null) {
      gaps.push({ id: `guard:${file}`, message: `${file}: no test next to it` });
      continue;
    }
    const unnamed = guards.filter((guard) => !testText.includes(guard));
    if (unnamed.length > 0) {
      gaps.push({
        id: `guard:${file}`,
        message: `${file}: its test does not name ${unnamed.join(", ")}`,
      });
    } else if (!titlesOf(testText).some((title) => DENIAL_TITLE.test(title))) {
      gaps.push({ id: `guard:${file}`, message: `${file}: its test has no case about a refusal` });
    }
  }

  for (const permission of input.permissions) {
    const quoted = `"${permission}"`;
    if (!input.matrixTestText.includes(quoted)) {
      gaps.push({
        id: `permission:${permission}`,
        message: `${permission}: not in the permission matrix test`,
      });
    } else if (
      input.permissionsUsedInCode.includes(permission) &&
      !input.otherTestsText.includes(quoted)
    ) {
      gaps.push({
        id: `permission:${permission}`,
        message: `${permission}: guards code, but no test of that code names it`,
      });
    }
  }

  return gaps;
}

export interface RiskCheck {
  /** Gaps nobody accepted: the release is blocked. */
  blocked: Gap[];
  /** Entries that are incomplete or whose gap no longer exists. */
  problems: string[];
}

/** Pure. A gap is allowed only by an accepted risk that is complete and still needed. */
export function applyAcceptedRisks(
  gaps: readonly Gap[],
  risks: readonly AcceptedRisk[],
): RiskCheck {
  const problems: string[] = [];
  const accepted = new Set<string>();

  for (const risk of risks) {
    const missing = (["item", "reason", "accepted_by", "accepted_on"] as const).filter(
      (field) => risk[field].trim() === "",
    );
    if (missing.length > 0) {
      problems.push(`${risk.item || "(no item)"}: missing ${missing.join(", ")}`);
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(risk.accepted_on)) {
      problems.push(`${risk.item}: accepted_on must be YYYY-MM-DD`);
    } else if (!gaps.some((gap) => gap.id === risk.item)) {
      problems.push(`${risk.item}: stale, there is no such gap any more: remove it`);
    } else {
      accepted.add(risk.item);
    }
  }

  return { blocked: gaps.filter((gap) => !accepted.has(gap.id)), problems };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const sqlCode = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

/** Reads the repo from its root. */
export function collectCoverageInput(root = process.cwd()): CoverageInput {
  const migrations = readdirSync(join(root, "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => sqlCode(readFileSync(join(root, "supabase", "migrations", name), "utf8")))
    .join("\n");

  const tables = [
    ...new Set(
      [...migrations.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1]),
    ),
  ];
  const rlsTables = [
    ...new Set(
      [...migrations.matchAll(/alter table (?:only )?public\.(\w+)\s+enable row level security/gi)].map(
        (m) => m[1],
      ),
    ),
  ];

  const src = walk(join(root, "src")).filter((file) => /\.tsx?$/.test(file));
  const isTest = (file: string) => file.endsWith(".test.ts");
  const sources = src.filter((file) => !isTest(file));
  const modelFile = join(root, "src", "lib", "auth", "permissions.ts");
  const matrixTest = join(root, "src", "lib", "auth", "permissions.test.ts");

  const guarded = sources.flatMap((file): GuardedFile[] => {
    const guards = [...new Set([...readFileSync(file, "utf8").matchAll(GUARD_PATTERN)].map((m) => `require${m[1]}`))];
    if (guards.length === 0) return [];
    const test = file.replace(/\.tsx?$/, ".test.ts");

    return [
      {
        file: relative(root, file),
        guards,
        testText: existsSync(test) ? readFileSync(test, "utf8") : null,
      },
    ];
  });

  const modelText = readFileSync(modelFile, "utf8");
  const permissions = [
    ...new Set(
      [...modelText.split("export const ROLE_PERMISSIONS")[0].matchAll(/\|\s*"([a-z_]+:[a-z_]+)"/g)].map(
        (m) => m[1],
      ),
    ),
  ];
  const appCode = sources
    .filter((file) => file !== modelFile)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  return {
    tables,
    rlsTables,
    rlsSuiteText: readFileSync(join(root, "src", "lib", "auth", "rls.integration.test.ts"), "utf8"),
    guarded,
    permissions,
    permissionsUsedInCode: permissions.filter((p) => appCode.includes(`"${p}"`)),
    matrixTestText: readFileSync(matrixTest, "utf8"),
    otherTestsText: src
      .filter((file) => isTest(file) && file !== matrixTest)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n"),
  };
}
