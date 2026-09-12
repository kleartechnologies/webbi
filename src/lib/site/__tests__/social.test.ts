import { describe, expect, it } from "vitest";
import { socialLinks, socialUrl } from "../links";

const canonicalInstagram = "https://www.instagram.com/amir.perodua/";

describe("socialUrl", () => {
  it("Instagram: @handle, bare handle, host-prefixed and full URLs all become the canonical profile URL", () => {
    const canonical = canonicalInstagram;
    for (const value of ["@amir.perodua", "amir.perodua", "instagram.com/amir.perodua", "www.instagram.com/amir.perodua/", "https://www.instagram.com/amir.perodua", "  @amir.perodua  "]) {
      expect(socialUrl("instagram", value), value).toBe(canonical);
    }
  });

  it("Instagram: a full URL to a post is kept, forced to https, without fragments", () => {
    expect(socialUrl("instagram", "https://instagram.com/p/abc123/")).toBe("https://instagram.com/p/abc123/");
    expect(socialUrl("instagram", "http://www.instagram.com/amir.perodua/#top")).toBe(canonicalInstagram);
  });

  it("Facebook: usernames, page URLs, fb.com and profile.php ids", () => {
    expect(socialUrl("facebook", "abckitchen")).toBe("https://www.facebook.com/abckitchen");
    expect(socialUrl("facebook", "@abckitchen")).toBe("https://www.facebook.com/abckitchen");
    expect(socialUrl("facebook", "facebook.com/abc.kitchen")).toBe("https://www.facebook.com/abc.kitchen");
    expect(socialUrl("facebook", "https://www.facebook.com/abc.kitchen/")).toBe("https://www.facebook.com/abc.kitchen");
    expect(socialUrl("facebook", "fb.com/abc")).toBe("https://www.facebook.com/abc");
    expect(socialUrl("facebook", "https://www.facebook.com/profile.php?id=1234#x")).toBe("https://www.facebook.com/profile.php?id=1234");
    expect(socialUrl("facebook", "https://fb.me/abc")).toBe("https://fb.me/abc");
  });

  it("TikTok: @handles and profile URLs become the canonical @ profile URL", () => {
    for (const value of ["@kedaiabc", "kedaiabc", "tiktok.com/@kedaiabc", "https://www.tiktok.com/@kedaiabc"]) {
      expect(socialUrl("tiktok", value), value).toBe("https://www.tiktok.com/@kedaiabc");
    }
    expect(socialUrl("tiktok", "https://www.tiktok.com/@kedaiabc/")).toBe("https://www.tiktok.com/@kedaiabc");
    expect(socialUrl("tiktok", "https://www.tiktok.com/@kedaiabc/video/123")).toBe("https://www.tiktok.com/@kedaiabc/video/123");
    expect(socialUrl("tiktok", "https://vm.tiktok.com/ZSabc/")).toBe("https://vm.tiktok.com/ZSabc/");
  });

  it("rejects javascript:, data:, protocol-relative, wrong-host and free-text values", () => {
    for (const value of ["javascript:alert(1)", "data:text/html,hi", "//evil.com/x", "http://evil.com/@amir", "https://facebook.com/amir", "ABC Kitchen", "a b", "@", "", "   "]) {
      expect(socialUrl("instagram", value), value).toBeNull();
    }
    expect(socialUrl("facebook", "https://instagram.com/amir")).toBeNull();
    expect(socialUrl("tiktok", "https://evil.com/@amir")).toBeNull();
    expect(socialUrl("instagram", undefined)).toBeNull();
    expect(socialUrl("instagram", null)).toBeNull();
    // A handle can never smuggle a path, query or script.
    expect(socialUrl("instagram", "amir/../../x")).toBeNull();
    expect(socialUrl("instagram", "amir?x=1")).toBeNull();
  });

  it("is idempotent: a stored canonical URL normalises to itself", () => {
    for (const [kind, value] of [["instagram", "@amir.perodua"], ["facebook", "abckitchen"], ["tiktok", "@kedaiabc"], ["facebook", "https://www.facebook.com/profile.php?id=1234"], ["tiktok", "https://www.tiktok.com/@kedaiabc/video/123"]] as const) {
      const once = socialUrl(kind, value);
      expect(once).not.toBeNull();
      expect(socialUrl(kind, once)).toBe(once);
    }
  });
});

describe("socialLinks", () => {
  it("returns only the platforms that normalise, in a fixed order, with labels for accessibility", () => {
    expect(socialLinks({ instagram: "@amir.perodua", facebook: "ABC Kitchen", tiktok: "@amir.perodua" })).toEqual([
      { kind: "instagram", label: "Instagram", url: canonicalInstagram },
      { kind: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@amir.perodua" },
    ]);
  });

  it("is empty when nothing is set or nothing is valid, so no social section renders", () => {
    expect(socialLinks({})).toEqual([]);
    expect(socialLinks({ instagram: "javascript:alert(1)", facebook: "//evil.com", tiktok: "" })).toEqual([]);
  });
});
