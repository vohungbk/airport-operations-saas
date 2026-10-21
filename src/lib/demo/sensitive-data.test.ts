import { describe, expect, it } from "vitest";

import { findSensitiveData } from "@/lib/demo/sensitive-data";

// Samples of what the detector must catch. None of them is a real value, or
// even looks random: each is a plain pattern repeated ("aaaa..."), put together
// here from parts, so that this file holds no secret-shaped or high-entropy text
// of its own for a secret scanner (the commit hook, GitGuardian) to take for a
// real one. The detector matches on the shape, so these are enough.
const word = (...parts: string[]) => parts.join("");
const FAKE = {
  jwt: word("eyJ", "a".repeat(12), ".", "eyJ", "b".repeat(12), ".", "c".repeat(12)),
  awsKey: word("AK", "IA", "A".repeat(16)),
  privateKey: word("-----BEGIN RSA ", "PRIVATE KEY-----"),
  stripeKey: word("sk_", "live_", "a".repeat(12)),
  longStripeKey: word("sk_", "live_", "a".repeat(20)),
  bcryptHash: word("$2a$10$", "a".repeat(53)),
  assigned: (name: string, value: string) => `${name} = '${value}'`,
  typed: (name: string, value: string) => `${name} constant text := '${value}'`,
  longToken: "a1".repeat(24),
};

const kinds = (text: string, allow?: string[]) =>
  findSensitiveData(text, { allow }).map((f) => f.kind);

describe("findSensitiveData: what it catches", () => {
  it.each([
    ["an email address of a real domain", "contact: jane.doe@gmail.com", "email"],
    ["an email address of a company domain", "ops@acme-corp.com", "email"],
    ["an international phone number", "call +971 4 123 4567 today", "phone number"],
    ["a phone number with 00", "call 00971 50 123 4567", "phone number"],
    ["a phone number in groups", "(415) 555-0132", "phone number"],
    ["a card number that passes the Luhn check", "card 4111 1111 1111 1111", "card number"],
    ["a card number written without spaces", "4242424242424242", "card number"],
    ["a card number written with dashes", "4111-1111-1111-1111", "card number"],
    ["an IBAN that passes the mod 97 check", "GB82 WEST 1234 5698 7654 32".replace(/ /g, ""), "iban"],
    ["an Emirates ID", "784-1990-1234567-1", "national id (Emirates ID)"],
    ["a social security number", "123-45-6789", "national id (SSN)"],
    ["a JWT", FAKE.jwt, "jwt"],
    ["a Stripe key", FAKE.stripeKey, "api key"],
    ["an AWS access key", FAKE.awsKey, "aws key"],
    ["a private key block", FAKE.privateKey, "private key"],
    ["a full bcrypt hash", FAKE.bcryptHash, "password hash"],
    ["a password written in the text", FAKE.assigned("pass" + "word", "x".repeat(12)), "credential in text"],
    ["a secret assigned with :=", FAKE.typed("c_" + "secret", "y1".repeat(6)), "credential in text"],
    ["a link to a real site", "see https://www.example.com/path and https://emirates.com/x", "url"],
    ["a long secret-looking token", `token ${FAKE.longToken}`, "long token"],
  ])("should catch %s", (_label, text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it("should not repeat a long secret in full in its report", () => {
    const [finding] = findSensitiveData(FAKE.longStripeKey);

    expect(finding.match.length).toBeLessThan(25);
  });
});

describe("findSensitiveData: what it leaves alone", () => {
  it.each([
    ["a demo email address", "technician1@airportops.example"],
    ["a demo email with subdomain", "ops@mail.democarrental.example"],
    ["a uuid made only of digits", "10000000-0000-0000-0000-000000000001"],
    ["a uuid of hex digits", "e0000000-0000-0000-0000-000000000021"],
    ["the start of a uuid that SQL completes", "('e0000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid"],
    ["a booking number", "BK-00021"],
    ["a seat serial", "SEAT-0040"],
    ["an ISO timestamp", "2026-09-10 09:00:00+04 and 2026-08-01T00:00:00.000Z"],
    ["a date", "2026-09-10"],
    ["a rate", "75.00 AED per day, 3 paid days"],
    ["an md5 made token", "c4ca4238a0b923820dcc509a6f75849b"],
    ["a link to a demo or local host", "http://localhost:3000/x http://127.0.0.1:54321 https://a.example/z"],
    ["a plain sentence", "Customer changed their plans; seat is safe"],
    ["a password hash salt only", "crypt(c_password, '$2a$10$DemoSeedFixedSaltAbcd.')"],
    ["a number that is not a card number", "4111 1111 1111 1112"],
    ["an IBAN-shaped text that fails the check", "GB00WEST12345698765432"],
  ])("should not report %s", (_label, text) => {
    expect(findSensitiveData(text)).toEqual([]);
  });

  it("should leave out a value that is public on purpose, and only that value", () => {
    const text = FAKE.typed("c_" + "pass" + "word", "DemoPassw0rd!");

    expect(kinds(text)).toContain("credential in text");
    expect(kinds(text, ["DemoPassw0rd!"])).toEqual([]);
    expect(kinds(FAKE.assigned("pass" + "word", "something-else"), ["DemoPassw0rd!"])).toContain("credential in text");
  });

  it("should still catch a real email next to an allowed value", () => {
    expect(kinds("DemoPassw0rd! and jane@gmail.com", ["DemoPassw0rd!"])).toEqual(["email"]);
  });
});
