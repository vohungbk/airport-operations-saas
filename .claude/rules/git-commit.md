# Git Commit Rules

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

## Format

```
<type>(<scope>): <short summary>

<body>

<footer>
```

- **type** — required, one of:
  - `feat` — a new feature
  - `fix` — a bug fix
  - `docs` — documentation only
  - `style` — formatting, whitespace; no code behavior change
  - `refactor` — code change that neither fixes a bug nor adds a feature
  - `perf` — performance improvement
  - `test` — adding or correcting tests
  - `build` — build system or dependency changes
  - `ci` — CI configuration changes
  - `chore` — anything else (tooling, config) that doesn't fit above
  - `revert` — reverts a previous commit
- **scope** — optional but preferred; the feature or area touched, e.g.
  `bookings`, `seats`, `technicians`, `cleaning`, `inspections`,
  `finance`, `flights`, `partners`, `airports`, `auth`, `ai`, or a
  cross-cutting area like `db`, `deps`, `hooks`.
- **short summary** — imperative mood, present tense ("add", not "added"
  or "adds"), lowercase first letter, no trailing period, ideally ≤ 50
  characters and never over 72.
- **body** — optional, wrap at ~72 chars. Explain *why* the change was
  made and what it affects, not a restatement of the diff. Skip it for
  genuinely trivial commits.
- **footer** — optional. Use `BREAKING CHANGE: <description>` for a
  breaking change, and reference issues/tickets (`Closes #123`,
  `Refs F05`) when applicable.

## Examples

```
feat(bookings): add cancellation flow for pending bookings

Adds a Server Action to cancel a booking while it's still in the
"pending" state and releases the reserved seat back to inventory.

Closes #142
```

```
fix(auth): refresh session before RLS-scoped query on dashboard load

Closes #98
```

```
chore(deps): bump @supabase/ssr to 0.12.5
```

## Rules

- **One logical change per commit.** Don't bundle an unrelated
  refactor, a dependency bump, and a feature in the same commit.
- **No emojis** in commit messages.
- **No AI/tool self-reference in the subject line** — if attribution is
  needed, it goes in a trailer, not the summary.
- **Never** use a vague subject like `fix stuff`, `wip`, or `update` —
  the summary must say what changed.
- A commit that only touches `.claude/`, `docs/`, or config should still
  use the correct type (`chore`, `docs`, `ci`) rather than `feat`/`fix`.
- Breaking changes to an API route's response shape, a database
  migration that isn't backward compatible, or a removed prop must be
  called out with `BREAKING CHANGE:` in the footer, even on a project
  without a public release yet — it documents intent for reviewers.
