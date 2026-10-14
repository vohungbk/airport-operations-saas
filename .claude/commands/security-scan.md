---
description: Security scan of dependencies and the current diff against web-security rules
allowed-tools: Bash(npm audit:*), Bash(git diff:*), Bash(git status), Bash(git log:*), Read, Grep, Glob
---

Run a security scan on the current branch. Follow `.claude/rules/web-security.md` and `docs/security.md`.

## Steps
1. Dependencies: `npm audit --omit=dev; echo "exit=$?"`
2. Secrets in the diff (committed on this branch, vs `main`, plus uncommitted):
   ```bash
   git diff main...HEAD | grep -nEi "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{16,}" || true
   git diff HEAD | grep -nEi "(api[_-]?key|secret|password|token)\s*[:=]\s*['\"][^'\"]{16,}" || true
   ```
3. Files that must not be in the diff: `.env`, `.env.*` (except `.env.example`), `.next`, `node_modules`, `tsconfig.tsbuildinfo`. Check with `git diff main...HEAD --name-only` and `git status --short`.
4. Review the changed code against the checklist:
   - [ ] No hardcoded secrets
   - [ ] No service-role key imported in client code or Client Components
   - [ ] No tokens, passwords or PII in logs
   - [ ] No token in any URL or query string
   - [ ] New tenant-scoped tables have RLS enabled in the same migration, with policies
   - [ ] No reliance on frontend filtering or a lone `WHERE tenant_id` for tenant isolation
   - [ ] New Server Actions and Route Handlers check auth and role (RBAC) on the server
   - [ ] External input is validated with Zod before business logic or DB calls
   - [ ] Route Handlers return the standardized error shape and leak no stack trace or raw DB error
   - [ ] No SQL built by string concatenation (including in RPC or `sql` helpers)
   - [ ] No `dangerouslySetInnerHTML` with user content
   - [ ] No `NEXT_PUBLIC_*` variable holds a secret

## Output
- Findings table: severity (High / Medium / Low), file:line, issue, fix.
- Flag High findings immediately.
- If nothing is found, say which checks were run. Do not claim more than was checked.
