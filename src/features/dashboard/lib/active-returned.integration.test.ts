import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { DEMO_ACCOUNTS, demoLogin } from "@/lib/demo/demo-seed";
import { createAnonClient, getLocalSupabaseConfig, signInTestUser, type LocalSupabaseConfig } from "@/lib/auth/rls-test-support";

/**
 * VI-F11-S04, AC01 and spec R3: the active and returned lists follow the scope of the viewer. Each demo account
 * reads them with its own session, so RLS decides the rows. A partner must never get a booking of the other
 * partner as the next item, and a queue returns one next item at most.
 */
const config = getLocalSupabaseConfig();
const PARTNERS = ["partner.dcr@airportops.example", "partner.dmo@airportops.example"] as const;

type Db = SupabaseClient<Database>;

describe.skipIf(!config)("the active and returned lists follow the scope of the viewer (VI-F11-S04)", () => {
  const cfg = config as LocalSupabaseConfig;
  const clients = new Map<string, Db>();
  const bookingIds = new Map<string, string[]>();

  beforeAll(async () => {
    for (const [email] of DEMO_ACCOUNTS) {
      const client = await signInTestUser(cfg, email, demoLogin());
      const { data, error } = await client.rpc("command_centre_active_returned");

      expect(error, email).toBeNull();
      clients.set(email, client);
      bookingIds.set(email, (data ?? []).filter((item) => item.queue === "active").map((item) => item.item_id));
    }
  }, 120_000);

  it.each(PARTNERS)("should not give %s a booking that another partner owns", async (email) => {
    const other = PARTNERS.find((candidate) => candidate !== email)!;
    const ids = bookingIds.get(email)!;

    if (ids.length === 0) return;

    const { data, error } = await clients.get(other)!.from("bookings").select("id").in("id", ids);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(DEMO_ACCOUNTS)("should give %s one next item for each list", async (email) => {
    const { data } = await clients.get(email)!.rpc("command_centre_active_returned");
    const queues = (data ?? []).map((item) => item.queue);

    expect(new Set(queues).size, email).toBe(queues.length);
  });

  it("should give no queue to a caller who is not signed in", async () => {
    const { data, error } = await createAnonClient(cfg).rpc("command_centre_active_returned");

    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
