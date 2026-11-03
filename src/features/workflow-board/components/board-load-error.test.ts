import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { BoardLoadError } from "@/features/workflow-board/components/board-load-error";

describe("BoardLoadError (AC10)", () => {
  it("should say the board could not be loaded and offer Retry, without any raw error", () => {
    const html = renderToStaticMarkup(createElement(BoardLoadError));

    expect(html).toContain('role="alert"');
    expect(html).toContain("The board could not be loaded.");
    expect(html).toContain("Retry");
  });
});
