import { describe, expect, it } from "vitest";

import { parseScannedCode } from "@/features/installations/lib/seat-scan";

const TOKEN = "11111111-2222-3333-4444-555555555555";

describe("parseScannedCode", () => {
  it("should read the token from the address a seat QR code holds", () => {
    expect(parseScannedCode(`https://app.example.com/q/${TOKEN}`)).toEqual({ kind: "token", token: TOKEN });
    expect(parseScannedCode(`  http://localhost:3000/q/${TOKEN}  `)).toEqual({ kind: "token", token: TOKEN });
  });

  it("should read a bare token as a token", () => {
    expect(parseScannedCode(TOKEN)).toEqual({ kind: "token", token: TOKEN });
  });

  it("should read any other typed text as a serial number", () => {
    expect(parseScannedCode(" SEAT-0001 ")).toEqual({ kind: "serial", serial: "SEAT-0001" });
  });

  it("should refuse empty text", () => {
    expect(parseScannedCode("")).toBeNull();
    expect(parseScannedCode("   ")).toBeNull();
  });

  it("should refuse an address that is not a seat scan page", () => {
    expect(parseScannedCode("https://app.example.com/jobs/abc")).toBeNull();
    expect(parseScannedCode(`https://app.example.com/q/${TOKEN}/extra`)).toBeNull();
    expect(parseScannedCode("https://app.example.com/q/")).toBeNull();
    expect(parseScannedCode("https://app.example.com/q/bad token")).toBeNull();
  });
});
