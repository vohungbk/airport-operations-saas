---
description: Read a GitHub ticket and plan against its ACs; implement after the user types approve
argument-hint: <issue-number or issue URL>
allowed-tools: Bash(gh issue view:*), Bash(git status), Bash(git branch:*), Bash(git switch:*), Bash(git pull:*), Bash(git log:*), Bash(git diff:*), Read, Grep, Glob, Edit, Write, Bash(npm run:*), Bash(npx tsc --noEmit:*), Bash(lsof:*), Bash(curl:*), Bash(pkill:*)
---

Implement ticket: $ARGUMENTS

The ticket already has acceptance criteria (AC). Do not rewrite stories or ACs.

## Phase 1: Read the ticket
1. Sync `main` first, before anything else:
   - Run `git status --short` and `git branch --show-current`.
   - If the working tree has uncommitted changes, stop and ask the user. Do not stash, discard or carry them over silently.
   - If the current branch already matches `<type>/<issue>-<slug>` for this issue, skip the sync and continue on it.
   - Otherwise run `git switch main` then `git pull --ff-only`. If the pull cannot fast-forward, stop and tell the user.
2. Parse the issue number from `$ARGUMENTS`.
3. Run `gh issue view <number> --repo vohungbk/airport-operations-saas`.
4. Extract: story, every AC (ID + text), assumptions, dependency, test scenarios.
5. Check the branch with `git branch --show-current`. Do not use a worktree.
   - If it already matches `<type>/<issue>-<slug>` for this issue, continue on it.
   - If it is `main` (synced in step 1), create the branch from it in the current checkout: `git switch -c <type>/<issue>-<slug>`.
     - `<type>`: `feat` for a Story/Feature, `fix` for a Bug, `chore` for a Task. Use the allowed types in `.claude/rules/git-workflow.md`.
     - `<slug>`: short kebab-case from the ticket title, without the ticket code prefix.
   - If it is another unrelated branch, stop and ask the user which branch to use.

## Phase 2: Explore and plan
1. Explore the repo for the code each AC touches. Follow `.claude/rules/frontend.md`, `.claude/rules/backend.md` and `CLAUDE.md`.
2. Output a plan with:
   - AC to task map (one row per AC: files to change, approach)
   - Test plan (happy path + at least 2 edge cases; follow `.claude/rules/testing.md`)
   - Impact surface (what else may break)
   - Security notes (per `.claude/rules/web-security.md`: RLS, RBAC, Zod, secrets)
   - Open questions
3. Do not edit any file in this phase.

## Phase 3: HARD GATE
Stop after the plan. Ask: "Approve this plan?"
- Running `/implement` only plans. Never start Phase 4 in the same turn.
- No code before the user types `approve` in chat. Any reply that approves counts, for example "approve" or "approve, implement theo đề xuất".
- Treat "implement theo đề xuất" as: answer every open question with the recommended option.
- If the reply approves and adds small notes, apply the notes and implement. If the reply only asks for a change or asks a question, update the plan, show it again and ask again. Do not implement yet.

## Phase 4: Implement (only after the user types approve)
1. Work task by task, following the approved plan. If the plan must change, stop and ask.
2. Write tests with Vitest. Test names are meaningful, for example "should return error when email is invalid". Every new or changed RLS policy needs a cross-tenant denial test. Only write the tests here. Do not run them: tests run once, in step 6.
3. Keep business logic out of React components. Use Zod for input validation and the existing Supabase server client. Do not add dependencies.
4. Run `/simplify` and apply the fixes.
5. Run `/verify --build` at the end and show the exit codes. This is the only place tests run, and it runs only the changed test files. Run it after steps 4 and 5, because they change the code.
6. Do not commit or push unless the user asks. Wait for the user's review first, unless they already asked to commit and open the PR. Commit format follows `.claude/rules/git-commit.md`: `feat(<scope>): <subject>`, tests in a separate `test(<scope>)` commit.

## Output
- Report each AC with a status: Pass / Fail / Block / Not run, and the evidence.
- End with the dev server URL and what to check.
