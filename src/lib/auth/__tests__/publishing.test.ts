import { describe, expect, it } from "vitest";
import { assertMayPublish, EmailUnverifiedError, mayPublish, VERIFY_EMAIL_MESSAGE } from "../publishing";

describe("who may publish", () => {
  it("lets a verified email account publish", () => {
    expect(mayPublish({ emailVerified: true, providers: ["password"] })).toBe(true);
  });

  it("lets a Google account publish without a separate verification step", () => {
    expect(mayPublish({ emailVerified: false, providers: ["google.com"] })).toBe(true);
    expect(mayPublish({ providers: ["password", "google.com"] })).toBe(true);
  });

  it("stops an unverified email account, and anything unknown", () => {
    expect(mayPublish({ emailVerified: false, providers: ["password"] })).toBe(false);
    expect(mayPublish({ providers: ["password"] })).toBe(false);
    expect(mayPublish({})).toBe(false);
    expect(mayPublish(null)).toBe(false);
    expect(mayPublish({ emailVerified: "true" as unknown as boolean })).toBe(false);
  });

  it("throws the verification message for unverified and anonymous callers", () => {
    expect(() => assertMayPublish({ emailVerified: false, providers: ["password"] })).toThrow(EmailUnverifiedError);
    expect(() => assertMayPublish({ isAnonymous: true, emailVerified: true })).toThrow(VERIFY_EMAIL_MESSAGE);
    expect(() => assertMayPublish({ isAnonymous: false, emailVerified: true })).not.toThrow();
  });
});
