/**
 * VI-F08-S03 (spec R3): the data rules of the schema, and what must test each
 * one. Test support only; nothing in the app imports it.
 *
 * A rule is a CHECK or UNIQUE constraint (or a standalone unique index), a
 * `change_*_status` function that moves a record along its states, or a history
 * table that nobody may change. The proof is the integration tests; this finds
 * the rule that no test covers.
 */
export interface TestFile {
  file: string;
  text: string;
}

export interface DataRuleInput {
  /** CHECK and UNIQUE constraints, and standalone unique indexes, from the catalog. */
  constraints: string[];
  /** The constraints that have a case in data-rules.integration.test.ts. */
  casedConstraints: string[];
  /** `change_*` functions of the public schema. */
  statusFunctions: string[];
  /** Tables with a trigger that refuses UPDATE and DELETE. */
  historyTables: string[];
  /** The history tables that have a case in data-rules.integration.test.ts. */
  casedHistoryTables: string[];
  tests: TestFile[];
}

export interface DataRuleGap {
  id: string;
  message: string;
}

/** A test title about a transition that is refused. */
const REFUSED_TRANSITION = /invalid|not allowed|illegal|terminal|skips|reject|refus|55000/i;

const titlesOf = (text: string): string[] =>
  [...text.matchAll(/\b(?:it|test)(?:\.each\([^)]*\))?\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

/** Pure. The data rules that no test covers. */
export function findDataRuleGaps(input: DataRuleInput): DataRuleGap[] {
  const gaps: DataRuleGap[] = [];

  for (const name of input.constraints) {
    if (!input.casedConstraints.includes(name)) {
      gaps.push({ id: `constraint:${name}`, message: `${name}: no case that breaks it` });
    }
  }
  for (const name of input.casedConstraints) {
    if (!input.constraints.includes(name)) {
      gaps.push({ id: `stale:${name}`, message: `${name}: has a case but is not in the schema any more` });
    }
  }

  for (const fn of input.statusFunctions) {
    const covered = input.tests.some(
      ({ text }) => text.includes(fn) && titlesOf(text).some((title) => REFUSED_TRANSITION.test(title)),
    );
    if (!covered) {
      gaps.push({
        id: `function:${fn}`,
        message: `${fn}: no test names it next to a case about a refused transition`,
      });
    }
  }

  for (const table of input.historyTables) {
    if (!input.casedHistoryTables.includes(table)) {
      gaps.push({ id: `history:${table}`, message: `${table}: no case that tries to change or delete a row` });
    }
  }

  return gaps;
}
