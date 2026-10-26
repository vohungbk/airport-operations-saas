import { describe, expect, it } from "vitest";

import { describeCounter } from "@/lib/forms/counter";

describe("describeCounter", () => {
  it("should count the characters against the limit", () => {
    expect(describeCounter("Seat is clean", 40)).toEqual({ text: "13 / 40", over: false });
  });

  it("should not be over at exactly the limit", () => {
    expect(describeCounter("abcde", 5)).toEqual({ text: "5 / 5", over: false });
  });

  it("should be over one character past the limit", () => {
    expect(describeCounter("abcdef", 5)).toEqual({ text: "6 / 5", over: true });
  });

  it("should show zero for an empty value", () => {
    expect(describeCounter("", 200)).toEqual({ text: "0 / 200", over: false });
  });

  it("should count an emoji and a letter with an accent once each", () => {
    // "e" followed by a combining accent counts as one letter after normalizing.
    expect(describeCounter("é", 10).text).toBe("1 / 10");
    expect(describeCounter("\u{1F600}\u{1F600}", 10).text).toBe("2 / 10");
  });
});
