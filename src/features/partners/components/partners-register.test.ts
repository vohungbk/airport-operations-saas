import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PartnersRegister } from "@/features/partners/components/partners-register";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const QUERY: PartnersQuery = {
  q: undefined,
  status: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 8,
};

const partner = (name: string, code = "ACME-01") => ({
  id: "p-1",
  name,
  code,
  status: "active",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  contact_email: "ops@example.test",
});

const draw = (partners: unknown[], total: number, query = QUERY) =>
  html(createElement(PartnersRegister, { partners, total, query } as never));

describe("PartnersRegister", () => {
  it("should show the code as a link to the partner, the name, the contact and the status", () => {
    const out = draw([partner("Acme Airport Services")], 1);

    expect(out).toContain('href="/partners/p-1"');
    expect(out).toContain("ACME-01");
    expect(out).toContain("Acme Airport Services");
    expect(out).toContain("ops@example.test");
    expect(out).toContain("Active");
  });

  it("should say which rows are shown out of how many", () => {
    expect(draw([partner("Acme")], 24)).toContain("Showing 1–8 of 24 partners");
  });

  it("should offer Create partner when no partner exists yet", () => {
    const out = draw([], 0);

    expect(out).toContain("No partners yet");
    expect(out).toContain("Create your first partner to start building your rental network.");
    expect(out).toContain('href="/partners/new"');
  });

  it("should offer Clear search when no partner matches the search", () => {
    const out = draw([], 0, { ...QUERY, q: "qwerty" });

    expect(out).toContain("No partners match your search");
    expect(out).toContain("Try another code, name or contact.");
    expect(out).toContain("Clear search");
    expect(out).toContain('href="/partners"');
  });

  it("should keep every button at least 44 px high", () => {
    const out = draw([partner("Acme")], 24);

    expect(out).toContain("min-h-11");
    expect(out).toContain("size-11");
  });
});
