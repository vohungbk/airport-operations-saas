---
description: Verify, push the branch and open a PR to main using the PR template
argument-hint: <issue-number>
allowed-tools: Bash(gh issue view:*), Bash(gh pr:*), Bash(gh api:*), Bash(lsof:*), Bash(curl:*), Bash(pkill:*), Bash(cp:*), mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__find, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__tabs_context, Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git push -u origin:*), Bash(npm run:*), Bash(npx tsc --noEmit:*), Read
---

Create a pull request for ticket: $ARGUMENTS

Run this only because the user asked for it. Pushing is outward-facing.

## Steps
1. Check the branch is not `main` and the working tree is clean (`git status`). If there are uncommitted changes, ask the user.
2. Run `/security-scan`. Stop on High findings.
3. Read the ticket: `gh issue view <number> --repo vohungbk/airport-operations-saas`. Copy every AC row verbatim.
4. Capture screenshot evidence (see "Screenshot evidence" below). Skip it, and say so, when the diff has no UI change.
5. Load the `pr-description` skill and fill `.github/PULL_REQUEST_TEMPLATE.md`:
   - `Closes #<number>`
   - AC table with status (Pass / Fail / Block / Skip / Not run) and real evidence
   - Impact assessment from the actual diff (`git diff main...HEAD`)
   - Verification checklist: tick only what was run (lint, build, RLS, service-role key, Zod)
   - Do not tick "passes in CI" yet
6. Push and create the PR:
   - `git push -u origin <branch>` (never force push)
   - `gh pr create --base main --title "<conventional title>" --body-file <file>`
   - Write the body file in the scratchpad directory, not in the repo.
7. Bind the PR with the ccd_pr tools if available. Report the PR link.

## Rules
- Base branch is `main`.
- Title follows `.claude/rules/git-commit.md`: `<type>(<scope>): <subject>`.
- Never enable auto-merge. Never merge the PR.
- No secrets, `.env` or build output in the diff. Screenshots are not committed to the PR branch.
- Note any new migration or RLS policy in the PR body and confirm its cross-tenant denial test exists.
