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
   - `# Evidence`: the screenshot table with the uploaded image links, or `n/a: no visible change` / `Not captured: <reason>`
   - Impact assessment from the actual diff (`git diff main...HEAD`)
   - Verification checklist: tick only what was run (lint, build, RLS, service-role key, Zod)
   - Do not tick "passes in CI" yet
6. Push and create the PR:
   - `git push -u origin <branch>` (never force push)
   - `gh pr create --base main --title "<conventional title>" --body-file <file>`
   - Write the body file in the scratchpad directory, not in the repo.
7. Bind the PR with the ccd_pr tools if available. Report the PR link.

## Screenshot evidence
Do this after `/verify --build` is green (that step stops any dev server), and only for a diff that changes UI (`src/app/**/page.tsx`, `src/components/**`, `src/features/**/components/**`). Docs, test-only and config-only diffs skip it.

1. **Pick the screens.** From the diff and the ACs, list the routes and states worth showing (for example list with data, empty state, validation error, detail, forbidden). At most 6 screenshots, each tied to an AC.
2. **Start the app.** Check `lsof -i :3000` is free, run `npm run dev` in the background, and confirm `curl` returns HTTP 200. Local Supabase must be running if the page reads data (`npx supabase start`).
3. **Capture** with the built-in browser (`mcp__Claude_Browser__*`):
   - Navigate to the page and `computer` `screenshot` at `scale: 1`. The tool result names the saved file path; `cp` it into the scratchpad directory as `<n>-<short-name>.jpg`.
   - Use a desktop viewport (about 1280 wide) and add one narrow shot (375) only when the change is about responsive layout.
   - If a page needs a signed-in user, use a seeded or test account typed by the user for this app. Never type a real password. If none is available, ask the user to sign in in the browser pane, then continue.
4. **Check each image before it leaves the machine.** Read the saved file. Drop any shot that shows a real email, token, customer data or anything outside local test data. This repository is public.
5. **Upload.** Screenshots go to a dedicated branch `pr-evidence`, never into the PR branch or the working tree:
   - Create the branch once if missing: `gh api repos/vohungbk/airport-operations-saas/git/refs -f ref=refs/heads/pr-evidence -f sha=$(git rev-parse origin/main)`.
   - For each image, write a JSON body (`message`, base64 `content`, `branch: pr-evidence`) in the scratchpad and run `gh api -X PUT repos/vohungbk/airport-operations-saas/contents/<branch-with-slashes-as-dashes>/<file> --input <body.json>`.
   - Embed with `![<screen> - <state>](https://github.com/vohungbk/airport-operations-saas/blob/pr-evidence/<branch-dashes>/<file>?raw=true)`.
6. **Stop the dev server** (`pkill -f "next dev"`).
7. If a screenshot cannot be captured or uploaded, write `Not captured: <reason>` in the table. Never invent or reuse an image from another change.

## Rules
- Base branch is `main`.
- Title follows `.claude/rules/git-commit.md`: `<type>(<scope>): <subject>`.
- Never enable auto-merge. Never merge the PR.
- No secrets, `.env` or build output in the diff. Screenshots are not committed to the PR branch.
- Note any new migration or RLS policy in the PR body and confirm its cross-tenant denial test exists.
