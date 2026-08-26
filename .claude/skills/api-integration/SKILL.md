---
name: api-integration
description: Step-by-step guide for creating a new Next.js Route Handler (API route) in this project, following .claude/rules/backend.md — Zod input validation, the Supabase server client, N+1-safe queries, the standardized JSON success/error shape, and the matching tests from .claude/rules/testing.md. Use when asked to create an API route, add an endpoint, build a webhook handler, expose a new API, or wire up a Route Handler for a feature domain (bookings, seats, technicians, cleaning, inspections, finance, flights, partners, airports, auth).
---

Use this skill whenever you're about to add or change a file under
`src/app/api/**/route.ts`. It operationalizes `.claude/rules/backend.md`
into concrete steps and file contents.

## 0. Confirm a Route Handler is actually the right tool

Per `.claude/rules/backend.md`, prefer a **Server Action** for mutations
triggered from this app's own UI. Only use a Route Handler for:
webhooks, external integrations, or a non-form mutation something else
needs to call over HTTP. If the request doesn't clearly need one of
those, ask before scaffolding a Route Handler.

## Steps

1. **Pick the path.** `src/app/api/<domain>/<resource>/route.ts`,
   mirroring the feature it belongs to (`bookings`, `seats`,
   `technicians`, ...). Export one `async function <METHOD>(request: Request)`
   per HTTP verb the route supports.

2. **Define the Zod schema** for the request body/query, colocated with
   the feature: `src/features/<domain>/<action>.schema.ts`. Export both
   the schema and its inferred TS type. Zod only — no Joi
   (`.claude/rules/backend.md`).

3. **Ensure the shared response helper exists**: `src/lib/api/response.ts`
   exporting `jsonSuccess(data, status?)` and
   `jsonError(code, message, status, details?)`. Create it the first time
   you touch a Route Handler if it isn't there yet — don't hand-roll the
   `{ error: { code, message } }` shape inline per route.

4. **Implement the handler**:
   - Parse the request body/query defensively (`request.json().catch(() => null)`).
   - `schema.safeParse(...)`; on failure, return `jsonError("VALIDATION_ERROR", ..., 400, parsed.error.flatten().fieldErrors)`.
   - Get the Supabase server client via `createClient()` from
     `@/lib/supabase/server` (never the browser client here).
   - Check auth/session before mutating; return `jsonError("UNAUTHORIZED", ..., 401)` if missing.
   - Query with a **nested `select`** to pull related rows in one round
     trip instead of looping (`.select("*, seat:seats(*)")`) —
     see `.claude/rules/backend.md`'s N+1 guidance.
   - Rely on RLS for tenant isolation; don't treat an app-level
     `.eq("tenant_id", ...)` as the only safeguard.
   - Map a Supabase error to `jsonError("INTERNAL_ERROR", ..., 500)` (or a
     more specific code/status if the error is a known case, e.g. a
     unique-constraint violation → `"CONFLICT"`, 409). Never forward the
     raw Postgres error message to the client.
   - Return `jsonSuccess(data, 201)` (or `200`) on success.

5. **Write tests** per `.claude/rules/testing.md`: at minimum a
   happy-path test and a validation-failure test. If the route touches a
   new or changed RLS-protected table, add an integration test proving
   cross-tenant access is denied.

6. **Verify**: `npm run lint`, `npx tsc --noEmit`, and the test suite if
   one is configured (check `package.json` first — see
   `.claude/rules/testing.md` for the current state of test tooling).

## Example

### Input

> "Create a POST /api/bookings endpoint that creates a booking for a
> given seat and customer."

### Output

New/changed files:

```
src/lib/api/response.ts                          (new — shared helper)
src/features/bookings/create-booking.schema.ts   (new)
src/app/api/bookings/route.ts                    (new)
src/app/api/bookings/route.test.ts               (new)
```

`src/lib/api/response.ts`:

```ts
import { NextResponse } from "next/server";

type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
```

`src/features/bookings/create-booking.schema.ts`:

```ts
import { z } from "zod";

export const createBookingSchema = z.object({
  seat_id: z.string().uuid(),
  customer_name: z.string().min(1),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
```

`src/app/api/bookings/route.ts`:

```ts
import { createClient } from "@/lib/supabase/server";
import { jsonError, jsonSuccess } from "@/lib/api/response";
import { createBookingSchema } from "@/features/bookings/create-booking.schema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid booking payload",
      400,
      parsed.error.flatten().fieldErrors,
    );
  }

  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return jsonError("UNAUTHORIZED", "Authentication required", 401);
  }

  // Nested select avoids a second round trip for the seat/category.
  const { data, error } = await supabase
    .from("bookings")
    .insert(parsed.data)
    .select("*, seat:seats(*, category:seat_categories(*))")
    .single();

  if (error) {
    return jsonError("INTERNAL_ERROR", "Failed to create booking", 500);
  }

  return jsonSuccess(data, 201);
}
```

`src/app/api/bookings/route.test.ts` (adapt to whichever runner the
project adopts — see `.claude/rules/testing.md`):

```ts
import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/bookings", () => {
  it("should create a booking with valid input", async () => {
    const request = new Request("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        seat_id: "11111111-1111-1111-1111-111111111111",
        customer_name: "Jane Doe",
        start_at: "2026-09-01T10:00:00Z",
        end_at: "2026-09-03T10:00:00Z",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.customer_name).toBe("Jane Doe");
  });

  it("should return VALIDATION_ERROR when seat_id is missing", async () => {
    const request = new Request("http://localhost/api/bookings", {
      method: "POST",
      body: JSON.stringify({ customer_name: "Jane Doe" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
```
