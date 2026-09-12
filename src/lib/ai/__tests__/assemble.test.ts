import { describe, expect, it } from "vitest";
import { normalizeMyPhone } from "../assemble";

describe("normalizeMyPhone", () => {
  it("turns common Malaysian formats into international digits", () => {
    expect(normalizeMyPhone("012-345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("+60 12 345 6789")).toBe("60123456789");
    expect(normalizeMyPhone("60123456789")).toBe("60123456789");
    expect(normalizeMyPhone("123456789")).toBe("60123456789");
  });
  it("returns undefined for empty or nonsensical input", () => {
    expect(normalizeMyPhone("")).toBeUndefined();
    expect(normalizeMyPhone(null)).toBeUndefined();
    expect(normalizeMyPhone("call me")).toBeUndefined();
    expect(normalizeMyPhone("12")).toBeUndefined();
  });
});
