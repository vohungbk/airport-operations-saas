import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * `npm run demo:reset` (scripts/demo-reset.sh) resets a database, so what it
 * refuses matters as much as what it does (spec E1). The script is run here
 * with a stand-in for `npx` that records what it is asked and answers `status`
 * with the API URL we choose, so no database is touched.
 */
const SCRIPT = join(process.cwd(), "scripts", "demo-reset.sh");

let dir: string;
let log: string;

function run(env: { apiUrl?: string; stackDown?: boolean }) {
  const result = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_LOG: log,
      FAKE_API_URL: env.apiUrl ?? "",
      FAKE_STATUS: env.stackDown ? "down" : "ok",
    },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);

  return { status: result.status, output: `${result.stdout}${result.stderr}`, calls };
}

describe("scripts/demo-reset.sh (VI-F07-S01, spec E1, E3)", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "demo-reset-"));
    log = join(dir, "calls.log");
    writeFileSync(log, "");
    const npx = join(dir, "npx");
    writeFileSync(
      npx,
      [
        "#!/usr/bin/env bash",
        'echo "$*" >> "$FAKE_LOG"',
        'if [ "$1" = "supabase" ] && [ "$2" = "status" ]; then',
        '  if [ "$FAKE_STATUS" = "down" ]; then exit 1; fi',
        '  echo "{\\"API_URL\\":\\"$FAKE_API_URL\\"}"',
        "fi",
        "exit 0",
        "",
      ].join("\n"),
    );
    chmodSync(npx, 0o755);
  });

  it.each([
    ["https://abcdefgh.supabase.co"],
    ["http://10.0.0.5:54321"],
    ["https://127.0.0.1.evil.example"],
    [""],
  ])("should refuse, and never reset, when the API is not local: %j", (apiUrl) => {
    const { status, output, calls } = run({ apiUrl });

    expect(status).toBe(1);
    expect(output).toContain("Refusing to reset");
    expect(calls.some((call) => call.includes("db reset"))).toBe(false);
  });

  it("should say how to start the stack, and reset nothing, when it is not running", () => {
    const { status, output, calls } = run({ stackDown: true });

    expect(status).toBe(1);
    expect(output).toContain("npx supabase start");
    expect(calls.some((call) => call.includes("db reset"))).toBe(false);
  });

  it.each([["http://127.0.0.1:54321"], ["http://localhost:54321"]])(
    "should reset a local database and then check the demo data: %s",
    (apiUrl) => {
      const { status, calls } = run({ apiUrl });

      expect(status).toBe(0);
      expect(calls.map((call) => call.split(" ").slice(0, 3).join(" "))).toEqual([
        "supabase status -o",
        "supabase db reset",
        "vitest run src/lib/demo",
      ]);
    },
  );
});
