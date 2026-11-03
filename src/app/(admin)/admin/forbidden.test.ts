import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));

import WorkflowBoardForbidden from "@/app/(admin)/admin/forbidden";

const render = async () => renderToStaticMarkup(await WorkflowBoardForbidden());

describe("WorkflowBoardForbidden (CO-F08-S09)", () => {
  beforeEach(() => getCurrentUserMock.mockReset());

  it("should tell a partner user the board is restricted and lead back to its bookings", async () => {
    getCurrentUserMock.mockResolvedValue({ role: "partner_user" });

    const html = await render();

    expect(html).toContain("Access restricted");
    expect(html).toContain("You do not have permission to view this board.");
    expect(html).toContain('href="/bookings"');
    expect(html).toContain("Back to My bookings");
  });

  it("should lead a technician back to their jobs", async () => {
    getCurrentUserMock.mockResolvedValue({ role: "technician" });

    const html = await render();

    expect(html).toContain('href="/technician"');
    expect(html).toContain("Back to Today&#x27;s Jobs");
  });

  it("should still say the board is restricted when the user cannot be read", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    expect(await render()).toContain("You do not have permission to view this board.");
  });
});
