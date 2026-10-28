# Git Workflow

## Branch Naming

All feature branches must follow this pattern:

```
<type>/<optional-issue-number>-<description>
```

**Allowed types:** `feat`, `fix`, `hotfix`, `refactor`, `perf`, `test`, `docs`, `chore`, `security`

**Examples:**
- `feat/42-add-feature`
- `fix/broken-link`
- `hotfix/critical-bug`
- `refactor/simplify-logic`
- `security/patch-vulnerability`

**Exempt branches:** `main`, `master`, `develop`, `staging`, `production`

## Commit Message Format

Use Conventional Commits format:

```
<type>(<scope>): <subject>

<optional body>

<optional footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `security`

**Examples:**
```
feat(api): add new endpoint for user data

fix(auth): resolve session timeout issue
Closes #123

security(input): sanitize user input in forms
```

## Pull Request Requirements

Before opening a PR:

- `npm run lint` passes
- `npm run test` passes
- `npm run build` passes
- New or changed RLS policies come with a cross-tenant denial test (see `testing.md`)
- Commit messages follow `.claude/rules/git-commit.md`

## Force Push Policy

- **Never force push to `main`, `master`, `develop`**
- Force push to feature branches only when necessary (rebasing)
- Always warn collaborators before force pushing a shared branch

## Worktree Workflow

This project uses git worktrees for parallel development.

**IDE Behavior:** Worktrees open in a new window (keeps current window open).

Quick reference:
```bash
make setup                     # one-time setup
make worktree-new <branch>     # create worktree + open IDE
make worktree-switch <branch>  # switch to existing worktree
make worktree-list             # show all worktrees
make worktree-rm <branch>      # remove worktree
```

**Runtime override:**
```bash
# Use environment variable
export CC_WORKTREE_IDE_MODE=new     # new window
export CC_WORKTREE_IDE_MODE=reuse   # replace current window

# Or use command flag
make worktree-new feat/my-branch --ide-mode new
```
