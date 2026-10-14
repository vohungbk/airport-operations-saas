# Web Security Rules

Scope: all code. Reasoning and details live in `docs/security.md`.

## Secrets

- Never expose the Supabase service-role key to the client. No
  `NEXT_PUBLIC_` prefix on any secret.
- Never commit `.env*` files or keys. `.githooks/pre-commit` scans staged
  changes, but do not rely on it alone.
- Do not log tokens, session data, or personal data.

## Tenant isolation

- RLS is the tenant boundary. Enable RLS in the same migration that
  creates a tenant-scoped table.
- Never rely on frontend filtering or a `WHERE tenant_id` clause alone.
- Every new or changed policy needs a cross-tenant denial test
  (see `testing.md`).

## Input and access

- Validate all external input with Zod before business logic or DB calls.
- Check authentication and role (RBAC) on the server in every Server
  Action and Route Handler. Hiding a button is not an access check.
- Return the standardized error shape from `backend.md`. Do not leak
  stack traces or raw database errors.

## Checklist before PR

- [ ] No secret in code, config, or client bundle
- [ ] RLS enabled and tested for new tables
- [ ] Zod validation on new inputs
- [ ] Server-side role check on new mutations
