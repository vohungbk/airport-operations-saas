import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getPartnerMock = vi.hoisted(() => vi.fn());
const getTermsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/partners/lib/get-partner-by-id", () => ({ getPartnerById: getPartnerMock }));
vi.mock("@/features/partners/lib/get-commercial-terms", () => ({
  getCommercialTerms: getTermsMock,
  COMMERCIAL_TERMS_LIMIT: 100,
}));
const formProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/features/partners/components/commercial-terms-form", () => ({
  // The inputs are filled in by the browser, so the page is checked by what it hands the form.
  CommercialTermsForm: (props: Record<string, unknown>) => {
    formProps.current = props;
    return "FORM";
  },
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import CommercialTermsPage from "@/app/(admin)/partners/[id]/terms/page";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";

const render = async () =>
  renderToStaticMarkup(await CommercialTermsPage({ params: Promise.resolve({ id: PARTNER_ID }) }));

const terms = (id: string, from: string, to: string | null, partner = 30, launch = 50) => ({
  id,
  partner_share_percent: partner,
  platform_share_percent: 100 - partner,
  launch_partner_share_percent: launch,
  launch_credit_target: null,
  annual_fee: 0,
  onboarding_fee: 0,
  vat_rate_percent: 0,
  payment_terms_days: 14,
  effective_from: from,
  effective_to: to,
});

const asRole = (role: string) => requirePermissionMock.mockResolvedValue({ id: "u-1", role });

/**
 * VI-F04-S01: the Commercial terms screen of a partner. The route group already needs
 * `partners:manage`; here an admin gets the form and an operations manager reads.
 */
describe("CommercialTermsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getPartnerMock.mockReset();
    getTermsMock.mockReset();
    notFoundMock.mockClear();
    formProps.current = null;
    asRole("admin");
    getPartnerMock.mockResolvedValue({ id: PARTNER_ID, name: "Demo Car Rental", code: "DCR" });
    getTermsMock.mockResolvedValue({ versions: [], truncated: false });
  });

  it("should check the permission to manage partners before reading anything (AC02)", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(requirePermissionMock).toHaveBeenCalledWith("partners:manage");
    expect(getPartnerMock).not.toHaveBeenCalled();
    expect(getTermsMock).not.toHaveBeenCalled();
  });

  it("should show the empty state and the form with 30 and 50 to an admin when there are no terms (AC01, AC02)", async () => {
    const html = await render();

    expect(html).toContain("Demo Car Rental");
    expect(html).toContain("No commercial terms yet");
    expect(html).toContain("FORM");
    expect(formProps.current).toMatchObject({
      partnerId: PARTNER_ID,
      defaultValues: { partner_share_percent: 30, launch_partner_share_percent: 50 },
    });
  });

  it("should show the terms in force to an admin, with the form starting from them", async () => {
    getTermsMock.mockResolvedValue({ versions: [terms("t-1", "2020-01-01", null, 40, 55)], truncated: false });

    const html = await render();

    expect(html).toContain("Terms in force");
    expect(html).toContain("40%");
    expect(formProps.current).toMatchObject({
      defaultValues: { partner_share_percent: 40, launch_partner_share_percent: 55 },
    });
  });

  it("should show an operations manager the terms but not the form (permission to edit)", async () => {
    asRole("operations_manager");

    const html = await render();

    expect(html).toContain("Read only");
    expect(html).not.toContain("FORM");
    expect(formProps.current).toBeNull();
  });

  it("should answer not found for an unknown partner, and read no terms", async () => {
    getPartnerMock.mockResolvedValue(null);

    await expect(render()).rejects.toThrow("NOT_FOUND");
    expect(getTermsMock).not.toHaveBeenCalled();
  });

  it("should list the earlier terms with the days they applied, to an admin (VI-F04-S03 AC01)", async () => {
    getTermsMock.mockResolvedValue({
      versions: [terms("t-2", "2020-06-01", null, 40), terms("t-1", "2020-01-01", "2020-05-31", 30)],
      truncated: false,
    });

    const html = await render();

    expect(html).toContain("Earlier terms");
    expect(html).toContain("2020-01-01 to 2020-05-31");
    expect(html).toContain("Terms in force");
  });

  it("should list the earlier terms to an operations manager too, read only", async () => {
    asRole("operations_manager");
    getTermsMock.mockResolvedValue({
      versions: [terms("t-2", "2020-06-01", null), terms("t-1", "2020-01-01", "2020-05-31")],
      truncated: false,
    });

    const html = await render();

    expect(html).toContain("2020-01-01 to 2020-05-31");
    expect(html).toContain("Read only");
  });

  it("should say there are no earlier terms when none has ended", async () => {
    expect(await render()).toContain("No earlier terms");
  });

  it("should note that older versions were cut off", async () => {
    getTermsMock.mockResolvedValue({ versions: [], truncated: true });

    expect(await render()).toContain("Only the latest 100 versions are shown.");
  });

  it("should link back to the partner", async () => {
    expect(await render()).toContain(`href="/partners/${PARTNER_ID}"`);
  });
});
