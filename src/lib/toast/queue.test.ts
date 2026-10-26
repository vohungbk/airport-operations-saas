import { describe, expect, it } from "vitest";

import { addToast, dismissToast, MAX_TOASTS, toastRole, type ToastItem } from "@/lib/toast/queue";

const item = (id: string): ToastItem => ({ id, kind: "info", message: id, duration: 1000 });

describe("addToast", () => {
  it("should add a toast at the end", () => {
    expect(addToast([item("a")], item("b")).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("should drop the oldest toast when the limit is passed", () => {
    let list: ToastItem[] = [];
    for (const id of ["a", "b", "c", "d"]) list = addToast(list, item(id));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list.map((t) => t.id)).toEqual(["b", "c", "d"]);
  });

  it("should not repeat a toast that has the same id", () => {
    expect(addToast([item("a")], item("a"))).toHaveLength(1);
  });
});

describe("dismissToast", () => {
  it("should remove only the toast with that id", () => {
    expect(dismissToast([item("a"), item("b")], "a").map((t) => t.id)).toEqual(["b"]);
  });

  it("should leave the list as it is for an id that is not there", () => {
    expect(dismissToast([item("a")], "x")).toHaveLength(1);
  });
});

describe("toastRole", () => {
  it("should announce an error at once and the rest politely", () => {
    expect(toastRole("error")).toBe("alert");
    expect(toastRole("success")).toBe("status");
    expect(toastRole("info")).toBe("status");
  });
});
