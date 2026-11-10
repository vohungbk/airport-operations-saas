---
description: Verify, push the branch and open a PR to main using the PR template
argument-hint: <issue-number>
allowed-tools: Bash(gh issue view:*), Bash(gh pr:*), Bash(gh api:*), Bash(lsof:*), Bash(curl:*), Bash(pkill:*), Bash(cp:*), mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__find, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__tabs_context, Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git push -u origin:*), Bash(npm run:*), Bash(npx tsc --noEmit:*), Read
---

Create a pull request for ticket: $ARGUMENTS

Run this only because the user asked for it. Pushing is outward-facing.

## Steps
1. Run `/security-scan`. Stop on High findings.
2. Read the ticket: `gh issue view <number> --repo vohungbk/airport-operations-saas`. Copy every AC row verbatim.
3. Load the `pr-description` skill and fill `.github/PULL_REQUEST_TEMPLATE.md`. Keep the body short:
   - `Closes #<number>`
   - Summary: what, why and the changes in a few lines, plus the notes a reviewer needs (a difference from the spec or the Figma, an open question).
   - AC table: criteria verbatim, and in the status cell one line with the status (Pass / Fail / Block / Skip / Not run) and the real evidence.
   - Impact assessment from the actual diff (`git diff main...HEAD`): one line per changed area, no more than 6 rows. Fold the regression scenarios into it.
   - Verification checklist: tick only what was run (lint, build, RLS, service-role key, Zod). Do not tick "passes in CI" yet.
4. Push and create the PR:
   - `git push -u origin <branch>` (never force push)
   - `gh pr create --base main --title "<conventional title>" --body-file <file>`
   - Write the body file in the scratchpad directory, not in the repo.
6. Report the PR link.

## Rules
- Title follows `.claude/rules/git-commit.md`: `<type>(<scope>): <subject>`.
- Never enable auto-merge.
- No secrets, `.env` or build output in the diff. Screenshots are not committed to the PR branch.
- Note any new migration or RLS policy in the PR body and confirm its cross-tenant denial test exists.
