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
| tests | `npm run test` | exit 0, with the local Supabase stack running |
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
