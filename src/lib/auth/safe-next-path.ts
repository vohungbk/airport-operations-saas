/**
 * The address a person is sent back to after signing in (FO-F03-S11, spec E11): the
 * page they asked for when they were signed out, for example the seat of a QR code.
 * It comes from the query string, so it is not trusted: a link that sends a person to
 * another site after they sign in is an open redirect. Only a path of this app is
 * accepted; anything else gives `null`, and the caller goes to the dashboard.
 *
 * Pure, no I/O.
 */

const MAX_LENGTH = 512;
/** A base that is not a real site, to tell a path of the app from an address of another. */
const BASE = "http://app.invalid";

/** Pages a person is sent away from, or that only have a use outside the app, so they are never a return address. */
const NOT_A_RETURN_ADDRESS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/forbidden",
  "/api",
] as const;

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** The path and query to go to, or `null` when the value is not a safe address of this app. */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value === "" || value.length > MAX_LENGTH) return null;

  // One slash, then a character that is not a slash or a backslash: `//host` and `/\host`
  // are an address of another site in a browser. No space or control character either: a
  // browser drops a tab or a line break inside an address, which can turn `/\t/host` into `//host`.
  if (!/^\/(?![/\\])/.test(value) || /[\\\s\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }

  if (url.origin !== BASE) return null;
  if (NOT_A_RETURN_ADDRESS.some((prefix) => isUnder(url.pathname, prefix))) return null;

  return `${url.pathname}${url.search}`;
}
