---
description: Run typecheck, lint, test (and build) and report exit codes
argument-hint: [--build]
allowed-tools: Bash(npx tsc --noEmit:*), Bash(npm run lint:*), Bash(npm run test:*), Bash(npx vitest:*), Bash(npm run build:*), Bash(git diff:*), Bash(git status)
---

Verify the current work. Arguments: $ARGUMENTS

Run these in order. Show the real exit code of each. Do not say "pass" without running.

1. `npx vitest run --changed main --passWithNoTests; echo "exit=$?"` (only the test files that changed against `main`, plus the tests that import a changed file; this is the one place tests run)
2. `npm run build; echo "exit=$?"` (run if `--build` is given or source files changed under `src/`; check with `git diff --stat` and `git status`)

## Output

End with one line: "All green" only if every exit code is 0. Otherwise list what failed.
