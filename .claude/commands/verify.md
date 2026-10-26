---
description: Run typecheck, lint, test (and build) and report exit codes
argument-hint: [--build]
allowed-tools: Bash(npx tsc --noEmit:*), Bash(npm run lint:*), Bash(npm run test:*), Bash(npx vitest:*), Bash(npm run build:*), Bash(git diff:*), Bash(git status)
---

Verify the current work. Arguments: $ARGUMENTS

Run these in order. Show the real exit code of each. Do not say "pass" without running.

1. `npx tsc --noEmit; echo "exit=$?"`
2. `npm run lint; echo "exit=$?"`
3. `npx vitest run --changed main --passWithNoTests; echo "exit=$?"` (only the test files that changed against `main`, plus the tests that import a changed file; this is the one place tests run)
4. `npm run build; echo "exit=$?"` (run if `--build` is given or source files changed under `src/`; check with `git diff --stat` and `git status`)

## Rules
- Do not stop at the first failure. Run all steps, then report.
- On a failure, show the failing file, line and message. Then propose a fix. Do not fix silently unless the user asked.
- Run the tests once, in step 3, and only the changed ones. Do not run `npm run test` or the whole suite unless the user asks.
- Do not skip, disable or edit tests or lint rules just to get green.
- Stop any running `next dev` server before step 4, because it shares the `.next` directory with the build.

## Output
| Step | Command | Exit code | Result |
|------|---------|-----------|--------|

End with one line: "All green" only if every exit code is 0. Otherwise list what failed.
