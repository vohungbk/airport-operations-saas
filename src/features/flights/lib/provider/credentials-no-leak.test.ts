import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * VI-F02-S10 (spec R14): the provider credentials stay on the server. This reads the source of
 * the app and fails when code could carry them to the browser: a second reader of the key, a
 * client file that imports the provider code, a public variable name, a log, or an error page
 * that prints what went wrong. It is a floor, not a proof: it reads text.
 */
const SRC = join(process.cwd(), "src");
const CONFIG_FILE = "src/features/flights/lib/provider/provider-config.ts";
const KEY_VARIABLE = "FLIGHT_PROVIDER_API_KEY";

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file);

/** Every source file of the app, as a path from the repository root, with its text. Tests are left out. */
const APP_FILES = listFiles(SRC)
  .filter((file) => !isTest(file))
  .map((file) => ({ file: relative(process.cwd(), file), source: readFileSync(file, "utf8") }));

type AppFile = (typeof APP_FILES)[number];

/** The files whose text matches. Pure, so the rules below can be tried on samples. */
function findOffenders(files: AppFile[], pattern: RegExp): string[] {
  return files.filter(({ source }) => pattern.test(source)).map(({ file }) => file);
}

/** An import of a file that holds or uses the credentials, by alias or by a relative path. */
const PROVIDER_IMPORT =
  /from\s+["'][^"']*(provider-config|provider-adapter|get-flight-source|get-provider-status|fixture-adapters|lib\/provider\/)[^"']*["']/;
const PUBLIC_NAME = /NEXT_PUBLIC_\w*(FLIGHT|PROVIDER)/i;

const isClientFile = ({ source }: AppFile) => /^\s*["']use client["']/m.test(source);

describe("flight provider credentials stay on the server", () => {
  it("should read the key variable in the provider configuration only", () => {
    expect(findOffenders(APP_FILES, new RegExp(KEY_VARIABLE))).toEqual([CONFIG_FILE]);
  });

  it("should not import the provider code from a client component", () => {
    const clientFiles = APP_FILES.filter(isClientFile);

    expect(clientFiles.length).toBeGreaterThan(0);
    expect(findOffenders(clientFiles, PROVIDER_IMPORT)).toEqual([]);
  });

  it("should not put a provider or flight variable behind the NEXT_PUBLIC_ prefix", () => {
    expect(findOffenders(APP_FILES, PUBLIC_NAME)).toEqual([]);
  });

  it("should not log or stop in the flight code or the provider settings pages", () => {
    const flightFiles = APP_FILES.filter(
      ({ file }) => file.startsWith("src/features/flights/") || file.includes("/settings/"),
    );

    expect(flightFiles.length).toBeGreaterThan(0);
    expect(findOffenders(flightFiles, /console\.|logger\.|debugger/)).toEqual([]);
  });

  it("should not print the error on the error page of the provider settings", () => {
    const page = APP_FILES.find(({ file }) => file.endsWith("settings/flight-provider/error.tsx"));

    expect(page).toBeDefined();
    expect(page?.source).not.toMatch(/error\.(message|stack|digest)/);
  });
});

describe("the rules above", () => {
  const sample = (file: string, source: string): AppFile => ({ file, source });

  it("should find a second reader of the key", () => {
    const files = [sample("src/app/leak.ts", `const k = process.env.${KEY_VARIABLE};`)];

    expect(findOffenders(files, new RegExp(KEY_VARIABLE))).toEqual(["src/app/leak.ts"]);
  });

  it("should find a client file that imports the provider code", () => {
    const client = sample(
      "src/app/widget.tsx",
      `"use client";\nimport { getFlightSource } from "@/features/flights/lib/provider/get-flight-source";`,
    );

    expect(isClientFile(client)).toBe(true);
    expect(findOffenders([client], PROVIDER_IMPORT)).toEqual(["src/app/widget.tsx"]);
  });

  it("should find a public variable that names the provider", () => {
    const files = [sample("src/x.ts", "process.env.NEXT_PUBLIC_FLIGHT_PROVIDER_API_KEY")];

    expect(findOffenders(files, PUBLIC_NAME)).toEqual(["src/x.ts"]);
  });

  it("should find a client file that imports the provider code by a relative path", () => {
    const client = sample(
      "src/features/flights/components/widget.tsx",
      `"use client";\nimport { getProviderStatus } from "../lib/get-provider-status";`,
    );

    expect(findOffenders([client], PROVIDER_IMPORT)).toEqual(["src/features/flights/components/widget.tsx"]);
  });

  it("should not flag a server file that has no such text", () => {
    const files = [sample("src/ok.ts", "export const a = 1;")];

    expect(findOffenders(files, PUBLIC_NAME)).toEqual([]);
  });
});
