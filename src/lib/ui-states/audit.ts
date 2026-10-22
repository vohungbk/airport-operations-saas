import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * VI-F08-S07 (spec R7): loading, empty, error, permission and not-found states
 * exist where relevant. This reads the pages of src/app and finds a page that
 * lacks the state it needs. Test support only; nothing in the app imports it.
 * It reads text, so it is a floor: how each state looks is recorded from the
 * screen in docs/ui-states-review.md.
 */

export interface AppPage {
  /** Path under src/app, e.g. `(admin)/seats/page.tsx`. */
  file: string;
  source: string;
}

export interface StateGap {
  /** What `UI_STATE_EXCEPTIONS` refers to, e.g. `loading:(admin)/admin/page.tsx`. */
  id: string;
  message: string;
}

export interface StateException {
  id: string;
  reason: string;
}

/** A page that reads data when it is opened: it can be slow, and it can fail. */
export function fetchesData(source: string): boolean {
  return /\bawait\b/.test(source) && /\bget[A-Z]\w*\(/.test(source);
}

/** A page whose address holds an id: the record may not exist, or may be hidden by the database. */
export const isDynamicPage = (file: string) => /\[[^\]]+\]/.test(file);

/** A page that shows a table of records. */
export const isListPage = (source: string) => /<\w*Table\b/.test(source);

/** The page handles a record that is missing or hidden. */
export function handlesMissingRecord(source: string): boolean {
  return /notFound\(|PageNotFound|PageForbidden|was not found|cannot view/i.test(source);
}

/** The page says what it shows when there is nothing to show. */
export function hasEmptyState(source: string): boolean {
  return /PageEmpty/.test(source);
}

/** The boundary file of a kind in the segment of a page or in one above it, short of the app root. */
function boundaryAbove(pageFile: string, name: string, files: ReadonlySet<string>): string | null {
  for (let dir = dirname(pageFile); dir !== "."; dir = dirname(dir)) {
    if (files.has(join(dir, name))) return join(dir, name);
  }
  return null;
}

/** Pure. The states that a page lacks. */
export function findStateGaps(pages: readonly AppPage[], files: ReadonlySet<string>): StateGap[] {
  const gaps: StateGap[] = [];

  for (const { file, source } of pages) {
    if (fetchesData(source)) {
      if (!boundaryAbove(file, "loading.tsx", files)) {
        gaps.push({ id: `loading:${file}`, message: `${file}: reads data but has no loading.tsx in its segment` });
      }
      if (!boundaryAbove(file, "error.tsx", files)) {
        gaps.push({ id: `error:${file}`, message: `${file}: reads data but has no error.tsx in its segment` });
      }
    }
    if (isDynamicPage(file) && !handlesMissingRecord(source)) {
      gaps.push({ id: `not-found:${file}`, message: `${file}: has an id in its address but no state for a missing record` });
    }
    if (isListPage(source) && !hasEmptyState(source)) {
      gaps.push({ id: `empty:${file}`, message: `${file}: shows a table but no message for when it is empty` });
    }
  }

  return gaps;
}

export interface ExceptionCheck {
  /** Gaps that no exception explains. */
  blocked: StateGap[];
  /** Exceptions with no reason, or for a gap that no longer exists. */
  problems: string[];
}

/** Pure. A gap is allowed only by an exception that has a reason and is still needed. */
export function applyExceptions(
  gaps: readonly StateGap[],
  exceptions: readonly StateException[],
): ExceptionCheck {
  const problems: string[] = [];
  const allowed = new Set<string>();

  for (const { id, reason } of exceptions) {
    if (reason.trim() === "") {
      problems.push(`${id}: no reason`);
    } else if (!gaps.some((gap) => gap.id === id)) {
      problems.push(`${id}: stale, the page has the state now: remove it`);
    } else {
      allowed.add(id);
    }
  }

  return { blocked: gaps.filter((gap) => !allowed.has(gap.id)), problems };
}

/** Reads the pages and the boundary files of src/app. */
export function readApp(root = process.cwd()): { pages: AppPage[]; files: Set<string> } {
  const app = join(root, "src", "app");
  const all = (readdirSync(app, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f));

  return {
    files: new Set(all),
    pages: all
      .filter((f) => /(^|\/)page\.tsx$/.test(f))
      .map((file) => ({ file, source: readFileSync(join(app, file), "utf8") })),
  };
}
