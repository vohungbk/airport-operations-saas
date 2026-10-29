import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onlineMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/jobs/hooks/use-online-status", () => ({
  useOnlineStatus: onlineMock,
}));

import { OfflineBanner } from "@/features/jobs/components/offline-banner";

describe("OfflineBanner", () => {
  beforeEach(() => {
    onlineMock.mockReset();
  });

  it("should say there is no connection and that the input is kept when the phone is offline", () => {
    onlineMock.mockReturnValue(false);

    const html = renderToStaticMarkup(createElement(OfflineBanner));

    expect(html).toContain("No connection");
    expect(html).toContain("Your input is kept");
    expect(html).toContain('role="alert"');
  });

  it("should draw nothing when the phone is online", () => {
    onlineMock.mockReturnValue(true);

    expect(renderToStaticMarkup(createElement(OfflineBanner))).toBe("");
  });
});
