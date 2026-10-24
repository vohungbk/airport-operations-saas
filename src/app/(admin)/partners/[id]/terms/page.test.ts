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
vi.mock("@/features/partners/lib/get-commercial-terms", () => ({ getCommercialTerms: getTermsMock }));
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
    getTermsMock.mockResolvedValue([]);
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
    getTermsMock.mockResolvedValue([
      {
        id: "t-1",
        partner_share_percent: 40,
        platform_share_percent: 60,
        launch_partner_share_percent: 55,
        effective_from: "2020-01-01",
        effective_to: null,
      },
    ]);

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

  it("should link back to the partner", async () => {
    expect(await render()).toContain(`href="/partners/${PARTNER_ID}"`);
  });
});
