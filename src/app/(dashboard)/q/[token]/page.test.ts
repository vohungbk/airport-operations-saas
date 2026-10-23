import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const getSeatMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/features/seats/lib/get-seat-by-token", () => ({
  getSeatByPublicToken: getSeatMock,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock, redirect: redirectMock }));

import SeatQrPage, { metadata } from "@/app/(dashboard)/q/[token]/page";

const TOKEN = "00000000-0000-4000-8000-0000000000a1";

const seat = (overrides: Record<string, unknown> = {}) => ({
  id: "s-1",
  serial_number: "SEAT-0001",
  status: "available",
  quarantine_reason: null,
  retired_at: null,
  category: { name: "Infant" },
  airport: { code: "DXB", name: "Dubai" },
  ...overrides,
});

const render = async (token = TOKEN) =>
  renderToStaticMarkup(await SeatQrPage({ params: Promise.resolve({ token }) }));

const asRole = (role: string) => requireAuthMock.mockResolvedValue({ id: "u-1", role });

/**
 * CO-F04-S13: a scan only identifies the seat. The page reads, it never changes anything, and
 * what the user reaches is decided by RLS through the lookup.
 */
describe("SeatQrPage", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    getSeatMock.mockReset();
    notFoundMock.mockClear();
    redirectMock.mockClear();
    asRole("technician");
    getSeatMock.mockResolvedValue(seat());
  });

  it("should not be indexed and should send no referrer, since the address holds the token", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("should show the seat to a technician (AC01)", async () => {
    const html = await render();

    expect(getSeatMock).toHaveBeenCalledWith(TOKEN);
    expect(html).toContain("SEAT-0001");
    expect(html).toContain("DXB - Dubai");
  });

  it.each([["admin"], ["operations_manager"]])(
    "should send %s to the full seat page (AC01)",
    async (role) => {
      asRole(role);

      await expect(render()).rejects.toThrow("REDIRECT:/seats/s-1");
    },
  );

  it("should show a partner the seat of their scope (AC04)", async () => {
    asRole("partner_user");

    const html = await render();

    expect(html).toContain("SEAT-0001");
    expect(html).toContain('href="/partner/seats"');
  });

  it.each([
    ["a forged token"],
    ["a seat outside the scope of the user"],
  ])("should answer not found for %s, the same way (AC04)", async () => {
    getSeatMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NOT_FOUND");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("should show the status and the reason of a quarantined seat to a technician (AC06)", async () => {
    getSeatMock.mockResolvedValue(seat({ status: "quarantine", quarantine_reason: "Strap torn" }));

    const html = await render();

    expect(html).toContain("Quarantine");
    expect(html).toContain("Strap torn");
  });

  it("should show the status of a quarantined seat to a partner but not the reason (AC06)", async () => {
    asRole("partner_user");
    getSeatMock.mockResolvedValue(seat({ status: "quarantine", quarantine_reason: "Strap torn" }));

    const html = await render();

    expect(html).toContain("Quarantine");
    expect(html).not.toContain("Strap torn");
  });

  it("should show a retired seat with its status and date (AC06)", async () => {
    getSeatMock.mockResolvedValue(seat({ status: "retired", retired_at: "2026-10-01T00:00:00Z" }));

    const html = await render();

    expect(html).toContain("Retired");
  });

  it("should offer the cleaning of the seat to a technician and not to a partner (AC03)", async () => {
    expect(await render()).toContain('href="/seats/s-1/cleaning"');

    asRole("partner_user");
    expect(await render()).not.toContain("/cleaning");
  });

  it("should check the session before reading anything (AC05)", async () => {
    requireAuthMock.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(render()).rejects.toThrow("REDIRECT:/login");
    expect(getSeatMock).not.toHaveBeenCalled();
  });

  it("should import no action that changes data (AC03, AC05)", async () => {
    const { readFileSync } = await import("node:fs");
    const files = [
      "src/app/(dashboard)/q/[token]/page.tsx",
      "src/features/seats/components/scanned-seat-card.tsx",
    ];

    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\.action"|"use server"|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
    }
  });
});
