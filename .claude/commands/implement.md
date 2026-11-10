---
description: Read a GitHub ticket and plan against its ACs; implement after the user types approve
argument-hint: <issue-number or issue URL>
allowed-tools: Bash(gh issue view:*), Bash(git status), Bash(git branch:*), Bash(git switch:*), Bash(git pull:*), Bash(git log:*), Bash(git diff:*), Read, Grep, Glob, Edit, Write, Bash(npm run:*), Bash(npx tsc --noEmit:*), Bash(lsof:*), Bash(curl:*), Bash(pkill:*)
---

Implement ticket: $ARGUMENTS

The ticket already has acceptance criteria (AC). Do not rewrite stories or ACs.

One ticket per session. If this session already implemented another ticket, say in one line that a new session is cheaper (the whole conversation is sent again on every call), then continue unless the user says otherwise.

## Phase 1: Read the ticket
1. Sync `main` first, before anything else:
   - Run `git status --short` and `git branch --show-current`.
   - If the working tree has uncommitted changes, stop and ask the user. Do not stash, discard or carry them over silently.
   - If the current branch already matches `<type>/<issue>-<slug>` for this issue, skip the sync and continue on it.
   - Otherwise run `git switch main` then `git pull --ff-only`. If the pull cannot fast-forward, stop and tell the user.
2. Parse the issue number from `$ARGUMENTS`.
3. Run `gh issue view <number> --repo vohungbk/airport-operations-saas`.
4. Extract: story, every AC (ID + text), assumptions, dependency, test scenarios.
5. Figma gate. Decide if the ticket changes the UI (a new or changed screen, component, copy or layout).
   - If it does, look for a Figma link in the ticket, in `$ARGUMENTS` and in the linked spec.
   - If there is no link, **stop the skill now**: say the ticket changes the UI and ask the user for the Figma link. Do not explore the code and do not write a plan. A plan made without the design gets rewritten.
   - With a link, open only the target frame by its node id. Take its screenshot and its design context, nothing wider (no page, no section). Build the UI from the common components that already exist (`src/components/ui`, `src/components/shared`, `src/components/charts`, and the feature's own). Do not write new markup for something a common component already does.
6. Check the branch with `git branch --show-current`. Do not use a worktree.
   - If it already matches `<type>/<issue>-<slug>` for this issue, continue on it.
   - If it is `main` (synced in step 1), create the branch from it in the current checkout: `git switch -c <type>/<issue>-<slug>`.
     - `<type>`: `feat` for a Story/Feature, `fix` for a Bug, `chore` for a Task. Use the allowed types in `.claude/rules/git-workflow.md`.
     - `<slug>`: short kebab-case from the ticket title, without the ticket code prefix.
   - If it is another unrelated branch, stop and ask the user which branch to use.

## Phase 2: Explore and plan
1. Explore the repo for the code each AC touches. Follow `.claude/rules/frontend.md`, `.claude/rules/backend.md` and `CLAUDE.md`.
   - Find with Grep first, then Read only the line ranges you need. Do not read a whole long file, the whole spec or old migrations unless an AC needs them. Read the spec only when the ticket does not say enough.
2. Output a short plan, about 25 lines at most, with only:
   - Changes: a few bullets with the files to change and the approach.
   - Impact surface: what else may break, in one or two lines.
   - Open questions, each with a recommended option.
   Do not write an AC table, a test plan or security notes in the plan. The tests are still written in Phase 4 (follow `.claude/rules/testing.md`) and the rules of `.claude/rules/web-security.md` still apply to the code.
3. Do not edit any file in this phase.

## Phase 3: HARD GATE
Stop after the plan. Ask: "Approve this plan?"
- Running `/implement` only plans. Never start Phase 4 in the same turn.
- No code before the user types `approve` in chat. Any reply that approves counts, for example "approve" or "approve, implement theo đề xuất".
- Treat "implement theo đề xuất" as: answer every open question with the recommended option.
- If the reply approves and adds small notes, apply the notes and implement. If the reply only asks for a change or asks a question, update the plan, show it again and ask again. Do not implement yet.

## Phase 4: Implement (only after the user types approve)
1. Work task by task, following the approved plan. If the plan must change, stop and ask.
2. Write tests with Vitest. Test names are meaningful, for example "should return error when email is invalid". Every new or changed RLS policy needs a cross-tenant denial test. Only write the tests here. Do not run them: tests run once, in step 5. Keep tests lean: one test per behaviour, and `it.each` for cases that differ only in their input.
3. Keep business logic out of React components. Use Zod for input validation and the existing Supabase server client. Do not add dependencies.
4. Start one read-only agent (Agent tool). Give it the list of changed and new files (`git diff --name-only` plus the untracked ones), not the whole repo, and tell it to grep only for names it sees in those files. It looks only for code that repeats something the repo already has (a helper, a component, a constant) and for dead or unused code. It returns at most 5 findings, each with `file:line` and the existing thing to reuse. Apply the fixes that do not change behaviour and skip the rest. No other review angle.
5. Run `/verify --build` at the end and show the exit codes. This is the only place tests run, and it runs only the changed test files. Run it after step 4, because it changes the code.
6. Do not commit or push unless the user asks. Wait for the user's review first, unless they already asked to commit and open the PR. Commit format follows `.claude/rules/git-commit.md`: `feat(<scope>): <subject>`, tests in a separate `test(<scope>)` commit.

## Output
- Do not summarise the agent's report again. Say only what was changed because of it, in one line.
