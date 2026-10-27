import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RESTYLE_CHECKS, RESTYLE_GROUPS, isGroupDone, restyledScreens, type RestyleGroup } from "@/lib/restyle/screen-groups";

const APP_DIR = join(process.cwd(), "src", "app");

describe("the order of the restyle (R12)", () => {
  it("should start with the sign-in and system pages, then reference data, bookings, field operations, incidents and dashboards", () => {
    const order = RESTYLE_GROUPS.map((g) => g.id).filter((id) => id !== "seat_detail_with_qr");

    expect(order).toEqual(["sign_in_and_system", "reference_data", "bookings", "field_operations", "incidents", "dashboards"]);
  });

  it("should put the seat detail with QR right after reference data, since it is the detail of a seat", () => {
    const ids = RESTYLE_GROUPS.map((g) => g.id);

    expect(ids.indexOf("seat_detail_with_qr")).toBe(ids.indexOf("reference_data") + 1);
  });

  it("should name each group by its rule of the spec, R1 to R7 in order", () => {
    expect(RESTYLE_GROUPS.map((g) => g.rule)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
  });
});

describe("the screens of each group", () => {
  it.each(RESTYLE_GROUPS.map((g) => [g.name, g] as const))("should list files that exist for %s", (_name, group) => {
    expect(group.screens.length).toBeGreaterThan(0);
    for (const screen of group.screens) expect(existsSync(join(APP_DIR, screen.file)), `${screen.name}: ${screen.file}`).toBe(true);
  });

  it("should give an address that starts with a slash, or none for a boundary", () => {
    for (const screen of RESTYLE_GROUPS.flatMap((g) => g.screens)) {
      expect(screen.route === null || screen.route.startsWith("/"), screen.name).toBe(true);
    }
  });

  it("should not list the same screen twice", () => {
    const names = RESTYLE_GROUPS.flatMap((g) => g.screens.map((s) => `${g.id}/${s.name}`));

    expect(new Set(names).size).toBe(names.length);
  });
});

describe("the checks (R8 to R11, R13)", () => {
  it("should check every group for the same things", () => {
    for (const group of RESTYLE_GROUPS) {
      expect(Object.keys(group.checks).sort(), group.id).toEqual(RESTYLE_CHECKS.map((c) => c.id).sort());
    }
  });

  it("should name the rule of each check", () => {
    expect(RESTYLE_CHECKS.map((c) => c.rule)).toEqual(["R8", "R9", "R10", "R11", "R13"]);
  });
});

describe("when a group is done (E4)", () => {
  const group = (restyled: boolean[], design: "done" | "noted" | "pending" = "done"): RestyleGroup => ({
    id: "g",
    name: "G",
    rule: "R1",
    screens: restyled.map((r, i) => ({ name: `S${i}`, route: `/s${i}`, file: "page.tsx", restyled: r })),
    checks: { same_behavior: "done", both_themes: "done", phone_layout: "done", page_states: "done", design_check: design },
  });

  it("should be done when every screen is restyled and every check is passed", () => {
    expect(isGroupDone(group([true, true]))).toBe(true);
  });

  it("should not be done while part of its screens is restyled", () => {
    expect(isGroupDone(group([true, false]))).toBe(false);
  });

  it("should count a difference noted for design review as passed", () => {
    expect(isGroupDone(group([true], "noted"))).toBe(true);
  });

  it("should not be done while a check is still pending", () => {
    expect(isGroupDone(group([true], "pending"))).toBe(false);
  });

  it("should count the restyled screens", () => {
    expect(restyledScreens(group([true, false, true]))).toBe(2);
  });
});

describe("where the restyle stands", () => {
  it("should have the sign-in and system pages done, with the missing design frame noted", () => {
    const [first] = RESTYLE_GROUPS;

    expect(isGroupDone(first)).toBe(true);
    expect(first.checks.design_check).toBe("noted");
    expect(first.notes?.join(" ")).toContain("design frame");
  });

  it("should have the reference data done, with the missing design frame noted", () => {
    const group = RESTYLE_GROUPS.find((g) => g.id === "reference_data")!;

    expect(isGroupDone(group)).toBe(true);
    expect(group.screens.every((s) => s.restyled)).toBe(true);
    expect(group.checks.design_check).toBe("noted");
  });

  it("should not mark the seat detail with QR done while the scanned seat page is not restyled (E4)", () => {
    const group = RESTYLE_GROUPS.find((g) => g.id === "seat_detail_with_qr")!;

    expect(group.screens.find((s) => s.name === "Seat detail")?.restyled).toBe(true);
    expect(group.screens.find((s) => s.name === "Scanned seat")?.restyled).toBe(false);
    expect(isGroupDone(group)).toBe(false);
  });

  it("should not mark a group done before its screens are restyled", () => {
    const later = RESTYLE_GROUPS.filter((g) => !["sign_in_and_system", "reference_data"].includes(g.id));

    for (const group of later) expect(isGroupDone(group), group.id).toBe(false);
  });

  it("should list every screen of the sign-in and system pages that R1 names", () => {
    const names = RESTYLE_GROUPS[0].screens.map((s) => s.name);

    expect(names).toEqual(["Sign in", "Sign up", "Forgot password", "Reset password", "Forbidden", "No partner", "Not found", "Error"]);
  });
});
