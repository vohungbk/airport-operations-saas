import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findNativeControls } from "@/lib/accessibility/library-guard";
import { findPlainLinks } from "@/lib/restyle/restyle-guard";
import { RESTYLE_GROUPS } from "@/lib/restyle/screen-groups";

const SRC = join(process.cwd(), "src");
const read = (path: string) => readFileSync(join(SRC, path), "utf8");

/** The forms and the shared parts that the sign-in and system pages are made of. */
const PARTS = [
  "features/auth/components/login-form.tsx",
  "features/auth/components/signup-form.tsx",
  "features/auth/components/forgot-password-form.tsx",
  "features/auth/components/reset-password-form.tsx",
  "features/auth/components/logout-button.tsx",
  "components/shared/page-state.tsx",
  "components/shared/page-error.tsx",
  "components/shared/standalone-page.tsx",
];

const [signInGroup] = RESTYLE_GROUPS;
const pages = [...new Set(signInGroup.screens.map((s) => `app/${s.file}`))];
const files = [...pages, "app/(auth)/layout.tsx", ...PARTS];

describe("sign-in and system pages (UI-F06-S01, R1, R10)", () => {
  it("should find every page and part, so the checks below are not empty", () => {
    expect(files.length).toBeGreaterThan(12);
    for (const file of files) expect(existsSync(join(SRC, file)), file).toBe(true);
  });

  it("should write no link as plain text: a link is a TextLink, 44 px high on a touch screen", () => {
    const offenders = files.flatMap((file) => findPlainLinks(read(file)).map((hit) => `${file}: ${hit}`));

    expect(offenders).toEqual([]);
  });

  it("should use the library for every control, with no native button, input, select or textarea", () => {
    const offenders = files.flatMap((file) => findNativeControls(read(file)).map((hit) => `${file}: ${hit}`));

    expect(offenders).toEqual([]);
  });
});

describe("the addresses stay as before (R8)", () => {
  it.each([
    ["features/auth/components/login-form.tsx", 'TextLink href="/forgot-password"'],
    ["features/auth/components/login-form.tsx", 'TextLink href="/signup"'],
    ["features/auth/components/signup-form.tsx", 'TextLink href="/login"'],
    ["features/auth/components/forgot-password-form.tsx", 'TextLink href="/login"'],
    ["app/(auth)/reset-password/page.tsx", 'TextLink href="/forgot-password"'],
    ["app/forbidden/page.tsx", "TextLink href={LOGIN_ROUTE}"],
  ])("should keep the link of %s to %s", (file, link) => {
    expect(read(file)).toContain(link);
  });
});

describe("findPlainLinks", () => {
  it("should find a Link with an underline written out", () => {
    expect(findPlainLinks('export const A = () => <Link href="/login" className="underline">Sign in</Link>;')).toEqual(['<Link href="/login">']);
  });

  it("should find a Link with no class", () => {
    expect(findPlainLinks('export const A = () => <Link href="/x">x</Link>;')).toHaveLength(1);
  });

  it("should find a native anchor", () => {
    expect(findPlainLinks('export const A = () => <a href="/x">x</a>;')).toEqual(["<a>"]);
  });

  it("should accept a TextLink", () => {
    expect(findPlainLinks('export const A = () => <TextLink href="/login">Sign in</TextLink>;')).toEqual([]);
  });

  it("should accept a Link that takes the look of a button", () => {
    expect(findPlainLinks('export const A = () => <Link href="/" className={buttonVariants({ variant: "outline" })}>Go back</Link>;')).toEqual([]);
  });
});
