import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * CO-F04-S14: the files on the path of a scan never write the token or the seat to a log, and
 * the error page does not print what went wrong.
 */
const SCAN_FILES = [
  "src/features/seats/lib/get-seat-by-token.ts",
  "src/features/seats/lib/seat-scan-access.ts",
  "src/features/seats/lib/seat-qr-metadata.ts",
  "src/features/seats/components/scanned-seat-card.tsx",
  "src/app/(dashboard)/q/[token]/page.tsx",
  "src/app/(dashboard)/q/[token]/not-found.tsx",
  "src/app/(dashboard)/q/[token]/error.tsx",
  "src/app/(dashboard)/q/[token]/loading.tsx",
];

describe("the scan path", () => {
  it.each(SCAN_FILES)("should not log anything in %s", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/console\.|logger\.|debugger/);
  });

  it("should not print the error on the error page", () => {
    const source = readFileSync("src/app/(dashboard)/q/[token]/error.tsx", "utf8");

    expect(source).not.toMatch(/error\.(message|stack|digest)/);
  });

  it("should never use the service role to look a seat up by its token", () => {
    const source = readFileSync("src/features/seats/lib/get-seat-by-token.ts", "utf8");

    expect(source).not.toMatch(/service[_-]?role|SERVICE_ROLE|createServiceClient/i);
  });
});
