# Pull Request

## Related Issue
Closes #

## Summary
Brief description of what changed and why.

---

**Status legend:** Pass | Fail | Block | Skip | Not run

- **Pass** — verified and works as expected
- **Fail** — verified and does not meet the criteria
- **Block** — could not be verified because a blocker/dependency prevents it
- **Skip** — intentionally not applicable / out of scope for this PR
- **Not run** — not yet verified

---

# Acceptance Criteria Verification

Copy **every** Acceptance Criteria row from the ticket verbatim, then set `Status` for each.

| ID | Criteria | Spec Ref | Status |
|----|----------|----------|--------|
| AC01 | | | **Not run** |
| AC02 | | | **Not run** |

---

# Impact Assessment

Based on the **actual code changed in this PR**, list each area a change touches (directly or via shared code/hooks/templates), what could break, and the regression scenario that proves it still works.

| Changed file / module | What changed | Who/what depends on it | Potential regression | Regression scenario verified |
|-----------------------|--------------|------------------------|----------------------|------------------------------|
| | | | | |

---

# Test Coverage

## Verification checklist
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] RLS enabled and tested for any new tenant-scoped table
- [ ] No service-role key exposed to the client
- [ ] Zod validation on all new Server Actions / Route Handlers

## Manual Testing Performed

What did you test manually to verify this change?

| Test scenario | Expected behavior | Actual result | Status |
|---------------|-------------------|---------------|--------|
| | | | **Not run** |

## Automated Tests

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests pass locally
- [ ] All tests pass in CI

## Regression Scenarios

Additional flows tested based on the Impact Assessment above:

- [ ] Flow A still works
- [ ] Flow B still works

---

# Evidence

## Screenshots

Taken from the running app with local test data only (this repository is public). Write `n/a: no visible change` when the PR has no UI change.

| Screen / state | AC | Screenshot |
|----------------|----|------------|
| | | |

## Test report

- [ ] Test report summary (Vitest run output / report)

## Other (optional)

- Videos, logs, API responses, etc.

---

# Bug Fix Analysis
*(Required only for bug fixes)*

## Root Cause

Describe the underlying cause of the issue.

## Introduced By

Link the commit/PR that introduced the issue, if known.

## Solution

Explain how the fix addresses the root cause.

---

# Final Verification

- [ ] All Acceptance Criteria are satisfied.
- [ ] Direct and regression scenarios have been tested.
- [ ] Tests and/or documentation have been updated if needed.
