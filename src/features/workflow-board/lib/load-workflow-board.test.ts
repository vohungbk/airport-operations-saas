import { beforeEach, describe, expect, it, vi } from "vitest";

const getWorkflowBoardMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/workflow-board/lib/get-workflow-board", () => ({ getWorkflowBoard: getWorkflowBoardMock }));

import { loadWorkflowBoard } from "@/features/workflow-board/lib/load-workflow-board";

describe("loadWorkflowBoard (AC10)", () => {
  beforeEach(() => {
    getWorkflowBoardMock.mockReset();
  });

  it("should give the board when it can be read", async () => {
    const board = { columns: [], total: 0, time_zone: null };
    getWorkflowBoardMock.mockResolvedValue(board);

    await expect(loadWorkflowBoard({})).resolves.toBe(board);
  });

  it("should give null and log only the code when the read fails", async () => {
    getWorkflowBoardMock.mockRejectedValue({ code: "XX000", message: "secret detail" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(loadWorkflowBoard({})).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Workflow board could not be read", { code: "XX000" });
    errorSpy.mockRestore();
  });

  it.each(["NEXT_REDIRECT;replace;/login", "NEXT_HTTP_ERROR_FALLBACK;403", "DYNAMIC_SERVER_USAGE"])(
    "should let a signal of Next.js through: %s",
    async (digest) => {
      getWorkflowBoardMock.mockRejectedValue(Object.assign(new Error("signal"), { digest }));

      await expect(loadWorkflowBoard({})).rejects.toMatchObject({ digest });
    },
  );
});
