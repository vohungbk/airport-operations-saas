# Release gates (VI-F08-S01)

One command runs the four checks a release candidate must pass (spec VI-F08 R1)
and records the result.

```bash
npm run release:gates
```

| Gate | Command | Passes when |
|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| lint | `npm run lint` | exit 0 |
| build | `npm run build` | exit 0 |

- **Every gate runs.** It does not stop at the first failure, so one run shows
  everything that is wrong. The exit code is 0 only when all four passed.
- **The tests gate is Not run without Supabase.** The integration tests (RLS,
  roles, demo data) skip themselves when the local stack is down, and a skipped
  suite looks green. Start the stack first (`npx supabase start`) and load the
  demo data (`npm run demo:reset`). A release candidate with a gate that was Not
  run is not release ready.
- **It refuses to start while a dev server runs** (exit 2), because `next dev`
  and `next build` share the `.next` directory. Stop it with `pkill -f "next dev"`.
- **The result is recorded** in `reports/release-gates.md` (git-ignored): the
  time, the commit (and whether the tree had uncommitted changes), one row per
  gate with its exit code, and the contents of
  [known-limitations.md](known-limitations.md). Copy it into the release notes.

Exit codes: 0 all passed, 1 a gate failed or was not run, 2 refused to start.

## Security coverage (VI-F08-S02, spec R2 and E1)

Permissions and tenant isolation must have automated tests. The check is
`src/lib/security/security-coverage.test.ts`. It runs with `npm test`, so a
failure makes the tests gate Fail and blocks the release. It needs no database.

It fails when:

- a table has no row level security in the migrations, or no test of the RLS
  integration suite (`src/lib/auth/rls.integration.test.ts`) names it;
- a file that calls `requirePermission`, `requireAnyPermission`, `requireRole`
  or `requirePartnerScope` has no test next to it, or its test does not name that
  guard, or has no case whose title is about a refusal;
- a permission is not in the permission matrix test, or it guards code and no test
  of that code names it.

The failure prints the id of each gap (for example `guard:src/.../x.action.ts`).
Two ways to clear it:

1. **Write the test.** This is the way.
2. **Accept the risk**, on purpose, in `src/lib/security/accepted-risks.ts`: the
   gap id as `item`, the `reason`, who accepted it (`accepted_by`) and the date
   (`accepted_on`, `YYYY-MM-DD`). The release goes on and the gap stays on record.
   An entry that is incomplete, or whose gap is gone, fails the check, so remove
   it when you write the test.

The check proves that a test exists and speaks about a refusal, not that it is
strong enough. The isolation itself is proven by the RLS integration suite.
