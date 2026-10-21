import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * `npm run demo:determinism` (scripts/demo-determinism.sh) resets the database
 * twice and compares a fingerprint of each load (VI-F07-S02). Here it runs with
 * stand-ins for `npx` and `docker`, so no database is touched: what it must
 * refuse, and that it says "equal" only when the two fingerprints are equal.
 */
const SCRIPT = join(process.cwd(), "scripts", "demo-determinism.sh");

let dir: string;
let log: string;

function run(env: { apiUrl?: string; first?: string; second?: string }) {
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_LOG: log,
      FAKE_COUNT: join(dir, "count"),
      FAKE_API_URL: env.apiUrl ?? "http://127.0.0.1:54321",
      FAKE_FP_1: env.first ?? "public.bookings|30|aaa",
      FAKE_FP_2: env.second ?? "public.bookings|30|aaa",
    },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);

  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
}

describe("scripts/demo-determinism.sh (VI-F07-S02)", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "demo-determinism-"));
    log = join(dir, "calls.log");
    writeFileSync(log, "");
    writeFileSync(join(dir, "count"), "0");

    const script = (name: string, body: string[]) => {
      const path = join(dir, name);
      writeFileSync(path, ["#!/usr/bin/env bash", ...body, ""].join("\n"));
      chmodSync(path, 0o755);
    };

    script("npx", [
      'echo "npx $*" >> "$FAKE_LOG"',
      'if [ "$1" = "supabase" ] && [ "$2" = "status" ]; then',
      '  echo "{\\"API_URL\\":\\"$FAKE_API_URL\\"}"',
      "fi",
      "exit 0",
    ]);
    // The fingerprint is whatever FAKE_FP_<n> says for the n-th call.
    script("docker", [
      'echo "docker $1" >> "$FAKE_LOG"',
      'n=$(( $(cat "$FAKE_COUNT") + 1 ))',
      'echo "$n" > "$FAKE_COUNT"',
      'var="FAKE_FP_$n"',
      'echo "${!var}"',
      "cat > /dev/null",
    ]);
  });

  it.each([["https://abcdefgh.supabase.co"], ["http://10.0.0.5:54321"], [""]])(
    "should refuse, and never reset, when the API is not local: %j",
    (apiUrl) => {
      const { status, output, calls } = run({ apiUrl });

      expect(status).toBe(1);
      expect(output).toContain("Refusing to reset");
      expect(calls.some((call) => call.includes("db reset"))).toBe(false);
    },
  );

  it("should reset twice, fingerprint after each reset, and say the loads are the same when the fingerprints are equal", () => {
    const { status, output, calls } = run({});

    expect(status).toBe(0);
    expect(output).toContain("the same data in every column of every table");
    expect(
      calls.filter((call) => call.startsWith("npx supabase db reset")),
    ).toHaveLength(2);
    expect(calls.filter((call) => call.startsWith("docker"))).toHaveLength(2);
    // reset, fingerprint, reset, fingerprint, in that order
    const order = calls
      .filter((call) => call.includes("db reset") || call.startsWith("docker"))
      .map((call) => (call.includes("db reset") ? "reset" : "fingerprint"));
    expect(order).toEqual(["reset", "fingerprint", "reset", "fingerprint"]);
  });

  it("should fail, and show the table that differs, when a single column changed between the loads", () => {
    const { status, output } = run({
      first: "public.bookings|30|aaa\npublic.seats|40|bbb",
      second: "public.bookings|30|aaa\npublic.seats|40|ccc",
    });

    expect(status).toBe(1);
    expect(output).toContain("The two loads differ");
    expect(output).toContain("public.seats|40|bbb");
    expect(output).toContain("public.seats|40|ccc");
    expect(output).not.toContain("the same data");
  });

  it("should fail when a row was added or lost between the loads", () => {
    const { status, output } = run({
      first: "public.bookings|30|aaa",
      second: "public.bookings|31|aaa",
    });

    expect(status).toBe(1);
    expect(output).toContain("The two loads differ");
  });
});
