---
description: Read a GitHub ticket and plan against its ACs; implement after the user types approve
argument-hint: <issue-number or issue URL>
allowed-tools: Bash(gh issue view:*), Bash(git status), Bash(git branch:*), Bash(git log:*), Bash(git diff:*), Read, Grep, Glob, Edit, Write, Bash(npm run:*), Bash(npx tsc --noEmit:*), Bash(lsof:*), Bash(curl:*), Bash(pkill:*)
---

Implement ticket: $ARGUMENTS

The ticket already has acceptance criteria (AC). Do not rewrite stories or ACs.

## Phase 1: Read the ticket
1. Parse the issue number from `$ARGUMENTS`.
2. Run `gh issue view <number> --repo vohungbk/airport-operations-saas`.
3. Extract: story, every AC (ID + text), assumptions, dependency, test scenarios.
4. Check the branch with `git branch --show-current`. Do not use a worktree.
   - If it already matches `<type>/<issue>-<slug>` for this issue, continue on it.
   - If it is `main` (or another exempt branch from `.claude/rules/git-workflow.md`), create the branch in the current checkout: `git switch -c <type>/<issue>-<slug>`.
     - `<type>`: `feat` for a Story/Feature, `fix` for a Bug, `chore` for a Task. Use the allowed types in `.claude/rules/git-workflow.md`.
     - `<slug>`: short kebab-case from the ticket title, without the ticket code prefix.
     - Stop and ask first if the working tree has uncommitted changes.
   - If it is another unrelated branch, stop and ask the user which branch to use.
5. Check each AC is testable. If an AC is vague or missing, ask the user. Do not guess.

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
2. Write tests with Vitest. Test names are meaningful, for example "should return error when email is invalid". Every new or changed RLS policy needs a cross-tenant denial test.
3. Keep business logic out of React components. Use Zod for input validation and the existing Supabase server client. Do not add dependencies.
4. Run `/code-review` on the changes. Fix the findings that are real, or say why you skip one.
5. Run `/simplify` and apply the fixes.
6. Run `/verify --build` at the end and show the exit codes. Run it after steps 4 and 5, because they change the code.
7. Right after step 6 is green, start the dev server for the user to review. Do not ask first.
   - Run it in the background from the repo root: `npm run dev` (runs `next dev` on port 3000).
   - Check that port 3000 is free first (`lsof -i :3000`). Check that the server answers HTTP 200 on `http://localhost:3000`.
   - If the feature needs a logged-in user, use a seeded test user from the project's seed files. Do not hardcode credentials or commit temporary helpers.
   - Give the user the URL, the pages and states to check, and anything known to be missing (for example a page that 404s because another feature owns it).
   - Tell the user how to stop it: `pkill -f "next dev"`. Keep it running until the user is done. Stop it before `npm run build`.
8. Do not commit or push unless the user asks. Wait for the user's review first, unless they already asked to commit and open the PR. Commit format follows `.claude/rules/git-commit.md`: `feat(<scope>): <subject>`, tests in a separate `test(<scope>)` commit.

## Output
- Report each AC with a status: Pass / Fail / Block / Not run, and the evidence.
- End with the dev server URL and what to check.
