import { describe, expect, it } from "vitest";

import {
  buildPartnersHref,
  isPartnersFiltered,
} from "@/features/partners/lib/build-partners-href";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";

const BASE: PartnersQuery = {
  q: undefined,
  status: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 8,
};

describe("buildPartnersHref", () => {
  it("should give a clean address for the default list", () => {
    expect(buildPartnersHref(BASE)).toBe("/partners");
  });

  it("should keep the search and the page when they are set", () => {
    expect(buildPartnersHref({ ...BASE, q: "acme" }, { page: 3 })).toBe(
      "/partners?q=acme&page=3",
    );
  });

  it("should keep a page size that is not the default", () => {
    expect(buildPartnersHref(BASE, { page_size: 16, page: 1 })).toBe(
      "/partners?page_size=16",
    );
  });

  it("should drop the search when it is cleared", () => {
    expect(buildPartnersHref({ ...BASE, q: "acme" }, { q: undefined })).toBe(
      "/partners",
    );
  });
});

describe("isPartnersFiltered", () => {
  it("should be false for the default list", () => {
    expect(isPartnersFiltered(BASE)).toBe(false);
  });

  it("should be true when a search narrows the list", () => {
    expect(isPartnersFiltered({ ...BASE, q: "qwerty" })).toBe(true);
  });
});
