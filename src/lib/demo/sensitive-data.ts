/**
 * VI-F07-S03, spec R3: finds data in a text that looks real and sensitive, so
 * the demo data (the seed files, and the rows once they are loaded) can be
 * checked for it. Pure, no I/O.
 *
 * It looks for personal data (an email address that is not a demo address, a
 * phone number, a national id), financial data (a card number that passes the
 * Luhn check, an IBAN that passes mod 97) and credentials (a JWT, an API key, a
 * private key, a full password hash, a password or secret written in the text, a
 * long secret-looking token), and for a link to a host that is not a demo or local
 * one. It errs on the side of reporting: a finding is looked at by a person, who
 * either removes the value or, for a value that is public on purpose, adds it to
 * `allow`.
 */
export interface SensitiveFinding {
  kind: string;
  /** The text that matched, shortened, so a report does not repeat a secret. */
  match: string;
}

export interface ScanOptions {
  /** Exact texts that are public on purpose; they are taken out before the scan. */
  allow?: readonly string[];
}

const DEMO_EMAIL_DOMAIN = /(^|\.)example$/i;
const DEMO_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$|(^|\.)example(:\d+)?$/i;

// A uuid, or the start of one that SQL puts together ('e0000000-0000-0000-0000-' || n).
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-(?:[0-9a-f]{12}\b)?/gi;
const ISO_DATETIME =
  /\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?\b/g;

/** Luhn: the check every card number passes. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }

  return sum % 10 === 0;
}

/** ISO 13616 mod 97: the check every IBAN passes. */
function passesIbanCheck(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;

  for (const ch of digits) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }

  return remainder === 1;
}

const short = (value: string) =>
  value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-4)}` : value;

export function findSensitiveData(
  text: string,
  { allow = [] }: ScanOptions = {},
): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  const add = (kind: string, match: string) => findings.push({ kind, match: short(match) });

  let rest = text;
  for (const allowed of allow) {
    rest = rest.split(allowed).join(" ");
  }

  // Emails first, on the text as it is: the domain is what decides.
  for (const m of rest.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
    if (!DEMO_EMAIL_DOMAIN.test(m[1])) add("email", m[0]);
  }

  // Links: only a demo or local host is fine.
  for (const m of rest.matchAll(/\bhttps?:\/\/([^\s/'"<>)]+)/gi)) {
    if (!DEMO_HOST.test(m[1])) add("url", m[0]);
  }

  // Credentials.
  for (const m of rest.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g)) add("jwt", m[0]);
  for (const m of rest.matchAll(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g)) add("api key", m[0]);
  for (const m of rest.matchAll(/\bAKIA[0-9A-Z]{16}\b/g)) add("aws key", m[0]);
  for (const m of rest.matchAll(/\bgh[pousr]_[A-Za-z0-9]{20,}/g)) add("github token", m[0]);
  for (const m of rest.matchAll(/\bxox[baprs]-[A-Za-z0-9-]{10,}/g)) add("slack token", m[0]);
  for (const m of rest.matchAll(/\bAIza[0-9A-Za-z_-]{30,}/g)) add("google key", m[0]);
  for (const m of rest.matchAll(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g)) add("private key", m[0]);
  for (const m of rest.matchAll(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g)) add("password hash", m[0]);
  for (const m of rest.matchAll(
    /\b\w*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|private[_-]?key)\w*(?:\s+constant)?(?:\s+\w+)?\s*(?::=|=|:)\s*['"]([^'"\s]{4,})['"]/gi,
  )) {
    add("credential in text", m[0]);
  }

  // What is left, with ids, dates and times taken out: they are made of digits and
  // dashes and would look like numbers.
  const plain = rest.replace(UUID, " ").replace(ISO_DATETIME, " ");

  for (const m of plain.matchAll(/\b[A-Za-z0-9+/_-]{40,}\b/g)) {
    if (/\d/.test(m[0]) && /[A-Za-z]/.test(m[0])) add("long token", m[0]);
  }

  for (const m of plain.matchAll(/(?<![\d.])(?:\d[ -]?){13,19}(?![\d.])/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) add("card number", m[0].trim());
  }

  for (const m of plain.matchAll(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g)) {
    if (passesIbanCheck(m[0])) add("iban", m[0]);
  }

  for (const m of plain.matchAll(/\b784-?\d{4}-?\d{7}-?\d\b/g)) add("national id (Emirates ID)", m[0]);
  for (const m of plain.matchAll(/\b\d{3}-\d{2}-\d{4}\b/g)) add("national id (SSN)", m[0]);

  // Phone numbers: international (+ or 00 and a country code), or the usual
  // groups of digits with separators.
  for (const m of plain.matchAll(/(?<![\w.])(?:\+|00)\d{1,3}[ .-]?\(?\d{1,4}\)?(?:[ .-]?\d{2,4}){2,4}(?![\w.])/g)) {
    add("phone number", m[0]);
  }
  for (const m of plain.matchAll(/(?<![\w.])\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?![\w.])/g)) {
    add("phone number", m[0]);
  }

  return findings;
}
