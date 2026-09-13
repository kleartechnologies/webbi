import { describe, expect, it } from "vitest";
import { authMode, authPath, CREATE_NEXT, DEFAULT_NEXT, isCreateIntent, safeNext } from "../intent";

describe("safeNext", () => {
  it("keeps a same-origin path so the visitor resumes where they were going", () => {
    expect(safeNext("/start")).toBe("/start");
    expect(safeNext("/s/abc123/edit")).toBe("/s/abc123/edit");
    expect(safeNext("/start?from=hero")).toBe("/start?from=hero");
  });

  it("falls back to the dashboard when there was no destination", () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT);
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNext("")).toBe(DEFAULT_NEXT);
  });

  it("never sends anyone off-site after they sign in", () => {
    for (const hostile of [
      "https://evil.example/steal",
      "//evil.example/steal",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil.example",
    ]) {
      expect(safeNext(hostile)).toBe(DEFAULT_NEXT);
    }
  });
});

describe("authPath", () => {
  it("carries the destination through /signin", () => {
    expect(authPath("/s/abc/edit")).toBe("/signin?next=%2Fs%2Fabc%2Fedit");
  });

  it("asks a new visitor to sign up, and still remembers they were building", () => {
    expect(authPath(CREATE_NEXT, "create")).toBe("/signin?mode=create&next=%2Fstart");
  });

  it("round-trips: what authPath writes, safeNext and authMode read back", () => {
    const url = new URL(authPath("/start", "create"), "https://webbi.my");
    expect(safeNext(url.searchParams.get("next"))).toBe("/start");
    expect(authMode(url.searchParams.get("mode"))).toBe("create");
  });
});

describe("authMode", () => {
  it("only ?mode=create opens the sign-up face", () => {
    expect(authMode("create")).toBe("create");
    expect(authMode("signin")).toBe("signin");
    expect(authMode("anything-else")).toBe("signin");
    expect(authMode(null)).toBe("signin");
  });
});

describe("isCreateIntent", () => {
  it("recognises the creation flow, so the copy can say what happens next", () => {
    expect(isCreateIntent("/start")).toBe(true);
    expect(isCreateIntent("/start?from=hero")).toBe(true);
    expect(isCreateIntent("/start/anything")).toBe(true);
  });

  it("is not fooled by a path that merely begins with the same letters", () => {
    expect(isCreateIntent("/startup")).toBe(false);
    expect(isCreateIntent("/dashboard")).toBe(false);
    expect(isCreateIntent("/s/abc/edit")).toBe(false);
  });
});
