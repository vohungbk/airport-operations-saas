import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findBareNumbers,
  findDataImports,
  findInternalOnlyImports,
  findLiveDataCalls,
  findMutationSurface,
  findStateWithoutCue,
} from "@/lib/components/component-guard";
import { listSourceFiles } from "@/lib/accessibility/source-files";

const SRC = join(process.cwd(), "src");
const read = (file: string) => readFileSync(file, "utf8");

const domainFiles = listSourceFiles(join(SRC, "components", "domain")).filter((f) => f.endsWith(".tsx"));
const partnerFiles = listSourceFiles(join(SRC, "app", "(partner)"));

/** Runs one finder over files and lists what it found, with the file, so a failure names the part. */
const scan = (files: string[], finder: (source: string) => string[]) =>
  files.flatMap((file) => finder(read(file)).map((hit) => `${relative(SRC, file)}: ${hit}`));

describe("domain components (R9, R12, R13)", () => {
  it("should find the domain components, so the checks below are not empty", () => {
    expect(domainFiles.length).toBeGreaterThan(10);
  });

  it("should take real data as props: no import of a feature, the database or the demo data", () => {
    expect(scan(domainFiles, findDataImports)).toEqual([]);
  });

  it("should not make up or fetch a value: no network call, clock or chance", () => {
    expect(scan(domainFiles, findLiveDataCalls)).toEqual([]);
  });

  it("should not write a hardcoded figure into the markup", () => {
    expect(scan(domainFiles, findBareNumbers)).toEqual([]);
  });

  it("should tell every state by an icon and text as well as color", () => {
    expect(scan(domainFiles, findStateWithoutCue)).toEqual([]);
  });

  it("should not include an internal-only part", () => {
    expect(scan(domainFiles, findInternalOnlyImports)).toEqual([]);
  });

  it("should not hold a form or a server action", () => {
    expect(scan(domainFiles, findMutationSurface)).toEqual([]);
  });
});

describe("partner screens (R13)", () => {
  it("should find the partner files, so the check below is not empty", () => {
    expect(partnerFiles.length).toBeGreaterThan(3);
  });

  it("should not import an internal-only part (adjustments, terms, simulator)", () => {
    expect(scan(partnerFiles, findInternalOnlyImports)).toEqual([]);
  });
});

describe("findDataImports", () => {
  it.each([
    ["a feature query", 'import { getSeats } from "@/features/seats/lib/get-seats";'],
    ["the database client", 'import { createClient } from "@/lib/supabase/server";'],
    ["the demo data", 'import { demo } from "@/lib/demo/demo-data";'],
    ["the request headers", 'import { headers } from "next/headers";'],
  ])("should find %s", (_name, code) => {
    expect(findDataImports(code)).toHaveLength(1);
  });

  it("should accept the library, a pure helper and an icon", () => {
    const code = 'import { Card } from "@/components/ui/card"; import { formatAmount } from "@/lib/money/money"; import { XIcon } from "lucide-react";';
    expect(findDataImports(code)).toEqual([]);
  });
});

describe("findLiveDataCalls", () => {
  it.each([
    ["fetch", "export const a = () => fetch('/x');"],
    ["the clock", "export const a = () => new Date();"],
    ["Date.now", "export const a = () => Date.now();"],
    ["chance", "export const a = () => Math.random();"],
  ])("should find %s", (_name, code) => {
    expect(findLiveDataCalls(code)).toHaveLength(1);
  });

  it("should accept a time that is passed in", () => {
    expect(findLiveDataCalls("export const a = (now: Date) => now.getTime();")).toEqual([]);
  });
});

describe("findBareNumbers", () => {
  it.each([
    ["a number in an expression", "export const A = () => <p>{42}</p>;"],
    ["an amount as text", "export const A = () => <p>12.50</p>;"],
    ["a percent as text", "export const A = () => <p>68%</p>;"],
    ["a number as a string", "export const A = () => <p>{'1,200.00'}</p>;"],
    ["a negative number", "export const A = () => <p>{-5}</p>;"],
  ])("should find %s", (_name, code) => {
    expect(findBareNumbers(code)).toHaveLength(1);
  });

  it.each([
    ["a figure given as a prop", "export const A = ({ n }: { n: string }) => <p>{n}</p>;"],
    ["a number inside words", "export const A = () => <p>Maximum 10 MB per photo</p>;"],
    ["a number in an attribute", "export const A = () => <div aria-valuemax={100} />;"],
  ])("should accept %s", (_name, code) => {
    expect(findBareNumbers(code)).toEqual([]);
  });
});

describe("findStateWithoutCue", () => {
  it("should find a state badge with text and no icon", () => {
    expect(findStateWithoutCue('export const A = () => <Badge variant="destructive">Failed</Badge>;')).toHaveLength(1);
  });

  it("should find a state badge with an icon and no text", () => {
    expect(findStateWithoutCue('export const A = () => <Badge variant="success"><CheckIcon /></Badge>;')).toHaveLength(1);
  });

  it("should accept a state badge with an icon and text", () => {
    expect(findStateWithoutCue('export const A = () => <Badge variant="destructive"><XIcon />Failed</Badge>;')).toEqual([]);
  });

  it("should treat a variant it cannot read as a state", () => {
    expect(findStateWithoutCue("export const A = ({ v }: { v: string }) => <Badge variant={v}>Failed</Badge>;")).toHaveLength(1);
  });

  it("should accept an icon that is a variable and text that is an expression", () => {
    expect(findStateWithoutCue("export const A = () => <Alert variant={x ? 'success' : 'destructive'}><Icon />{label}</Alert>;")).toEqual([]);
  });

  it("should not ask a neutral badge for an icon", () => {
    expect(findStateWithoutCue('export const A = () => <Badge variant="outline">Estimate</Badge>;')).toEqual([]);
  });

  it("should find a state color on a plain element with no icon", () => {
    expect(findStateWithoutCue('export const A = () => <p className="text-danger-fg">Upload failed</p>;')).toHaveLength(1);
  });

  it("should accept a state color on an element with an icon and text", () => {
    expect(findStateWithoutCue('export const A = () => <p className="text-danger-fg"><AlertIcon />Upload failed</p>;')).toEqual([]);
  });

  it("should not ask for a cue where the color is not a state", () => {
    expect(findStateWithoutCue('export const A = () => <p className="text-muted-foreground">Note</p>;')).toEqual([]);
  });
});

describe("findInternalOnlyImports", () => {
  it.each([
    ["an adjustment form", 'import { AdjustmentForm } from "@/features/bookings/components/adjustment-form";'],
    ["commercial terms", 'import { Summary } from "@/features/partners/components/commercial-terms-summary";'],
    ["the simulator", 'import { Run } from "@/features/finance/components/settlement-simulator";'],
  ])("should find %s", (_name, code) => {
    expect(findInternalOnlyImports(code)).toHaveLength(1);
  });

  it("should not take the name of a label for a part: ADJUSTMENT_LABEL comes from the money helper", () => {
    expect(findInternalOnlyImports('import { ADJUSTMENT_LABEL } from "@/lib/money/money";')).toEqual([]);
  });

  it("should accept a partner part", () => {
    expect(findInternalOnlyImports('import { PartnerSeatsTable } from "@/features/seats/components/partner-seats-table";')).toEqual([]);
  });
});

describe("findMutationSurface", () => {
  it("should find a form", () => {
    expect(findMutationSurface("export const A = () => <form />;")).toEqual(["<form>"]);
  });

  it("should find a use server file", () => {
    expect(findMutationSurface('"use server";\nexport async function a() {}')).toEqual(['"use server"']);
  });

  it("should find a server action import", () => {
    expect(findMutationSurface('import { save } from "@/features/seats/actions/save";')).toHaveLength(1);
  });

  it("should accept a part that only takes a callback", () => {
    expect(findMutationSurface("export const A = ({ on_select }: { on_select: () => void }) => <button onClick={on_select} />;")).toEqual([]);
  });
});
