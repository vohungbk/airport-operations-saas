import { execSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * TEST-ONLY infrastructure for the F05 RLS integration suite
 * (`src/lib/auth/rls.integration.test.ts`). Never import this from
 * application code — it shells out to the Supabase CLI for local
 * connection info and uses the local service-role key to bypass RLS for
 * fixture setup, which is only ever an "explicitly trusted server-side
 * administrative operation" (docs/security.md) in a test context.
 *
 * Per plan.md Task 30: deliberately NOT part of `supabase/seed.sql` — a
 * real test-account-provisioning step permanently in the default dev seed
 * is a footgun if that seed is ever pointed at a shared/staging project.
 * This only ever runs when the RLS integration test file itself imports
 * it, and only ever targets a loopback API URL (see the guard below).
 */

export interface LocalSupabaseConfig {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedConfig: LocalSupabaseConfig | null | undefined;

/**
 * Reads API URL / anon key / service-role key for the *local* Supabase
 * instance from `supabase status -o json` — never a hardcoded or
 * committed secret. Refuses to return anything whose API URL isn't
 * loopback, so this can never accidentally run against a shared/staging
 * project. Returns `null` (cached) when the local instance isn't running
 * or the CLI call fails for any reason — callers use this to skip the
 * whole suite rather than fail with a confusing connection error.
 */
export function getLocalSupabaseConfig(): LocalSupabaseConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  try {
    const raw = execSync("npx supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    }).toString();
    const parsed = JSON.parse(raw) as Record<string, string>;
    const apiUrl = parsed.API_URL;
    const anonKey = parsed.ANON_KEY;
    const serviceRoleKey = parsed.SERVICE_ROLE_KEY;

    const isLoopback =
      typeof apiUrl === "string" &&
      (apiUrl.includes("127.0.0.1") || apiUrl.includes("localhost"));

    cachedConfig =
      isLoopback && anonKey && serviceRoleKey
        ? { apiUrl, anonKey, serviceRoleKey }
        : null;
  } catch {
    cachedConfig = null;
  }

  return cachedConfig;
}

export function createServiceRoleClient(
  config: LocalSupabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(config.apiUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createAnonClient(
  config: LocalSupabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(config.apiUrl, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestIdentityDef {
  label: string;
  email: string;
  password: string;
  full_name: string;
  role: Database["public"]["Enums"]["user_role"];
  partner_id: string | null;
  is_active: boolean;
}

/** Seeded from supabase/seed.sql (fixed literal uuids, stable across `db reset`). */
export const PARTNER_A_ID = "b0000000-0000-0000-0000-000000000001"; // Emirates Rent A Car
export const PARTNER_B_ID = "b0000000-0000-0000-0000-000000000002"; // Al Futtaim Mobility

const PASSWORD = "Rls-Test-Password-1!";

/**
 * Task 30's minimum identity set, plus one extra (`partnerNull`) needed
 * for plan.md Task 31's "NULL partner_id" case: 1 admin, 1
 * operations_manager, 1 technician (real Auth identity, unlike F02's
 * seeded technicians), 2 partner_users on two different seeded partners,
 * 1 inactive user, 1 partner_user with partner_id null.
 */
export const TEST_IDENTITIES: TestIdentityDef[] = [
  {
    label: "admin",
    email: "rls-admin@test.local",
    password: PASSWORD,
    full_name: "RLS Test Admin",
    role: "admin",
    partner_id: null,
    is_active: true,
  },
  {
    label: "opsManager",
    email: "rls-ops-manager@test.local",
    password: PASSWORD,
    full_name: "RLS Test Ops Manager",
    role: "operations_manager",
    partner_id: null,
    is_active: true,
  },
  {
    label: "technician",
    email: "rls-technician@test.local",
    password: PASSWORD,
    full_name: "RLS Test Technician",
    role: "technician",
    partner_id: null,
    is_active: true,
  },
  {
    label: "partnerA",
    email: "rls-partner-a@test.local",
    password: PASSWORD,
    full_name: "RLS Test Partner A User",
    role: "partner_user",
    partner_id: PARTNER_A_ID,
    is_active: true,
  },
  {
    label: "partnerB",
    email: "rls-partner-b@test.local",
    password: PASSWORD,
    full_name: "RLS Test Partner B User",
    role: "partner_user",
    partner_id: PARTNER_B_ID,
    is_active: true,
  },
  {
    label: "inactive",
    email: "rls-inactive@test.local",
    password: PASSWORD,
    full_name: "RLS Test Inactive User",
    role: "partner_user",
    partner_id: PARTNER_A_ID,
    is_active: false,
  },
  {
    label: "partnerNull",
    email: "rls-partner-null@test.local",
    password: PASSWORD,
    full_name: "RLS Test Partner-Null User",
    role: "partner_user",
    partner_id: null,
    is_active: true,
  },
];

export interface ProvisionedIdentity {
  id: string;
  email: string;
  password: string;
}

/**
 * Creates (or reuses, if already present from a prior run that wasn't
 * followed by `supabase db reset`) a real `auth.users` row per
 * `TEST_IDENTITIES` entry via the GoTrue admin API, then sets the
 * matching `public.users` row (role/partner_id/is_active) directly via
 * the service-role client, which bypasses RLS entirely — exactly the
 * "explicitly trusted server-side administrative operation" case
 * docs/security.md's service-role policy allows, and only ever exercised
 * here in test setup, never from application code.
 */
export async function provisionTestIdentities(
  service: SupabaseClient<Database>,
): Promise<Record<string, ProvisionedIdentity>> {
  const result: Record<string, ProvisionedIdentity> = {};

  for (const identity of TEST_IDENTITIES) {
    const id = await ensureAuthUser(service, identity.email, identity.password);

    const { error } = await service.from("users").upsert(
      {
        id,
        email: identity.email,
        full_name: identity.full_name,
        role: identity.role,
        partner_id: identity.partner_id,
        is_active: identity.is_active,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(
        `failed to upsert public.users for test identity "${identity.label}": ${error.message}`,
      );
    }

    result[identity.label] = {
      id,
      email: identity.email,
      password: identity.password,
    };
  }

  return result;
}

async function ensureAuthUser(
  service: SupabaseClient<Database>,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && data.user) {
    return data.user.id;
  }

  // Already provisioned by a previous run of this suite without an
  // intervening `supabase db reset` — the admin API has no
  // filter-by-email, so page through admin.listUsers to find it.
  for (let page = 1; ; page += 1) {
    const { data: listData, error: listError } =
      await service.auth.admin.listUsers({ page, perPage: 200 });

    if (listError) {
      throw new Error(
        `failed to create or find auth user ${email}: create error "${error?.message}", list error "${listError.message}"`,
      );
    }

    const found = listData.users.find((u) => u.email === email);
    if (found) {
      return found.id;
    }

    if (listData.users.length < 200) {
      break;
    }
  }

  throw new Error(
    `failed to create or find auth user ${email}: ${error?.message}`,
  );
}

/** Signs in as a provisioned test identity on a fresh (non-shared) client. */
export async function signInTestUser(
  config: LocalSupabaseConfig,
  email: string,
  password: string,
): Promise<SupabaseClient<Database>> {
  const client = createAnonClient(config);
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`failed to sign in as ${email}: ${error.message}`);
  }

  return client;
}
