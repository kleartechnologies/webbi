import { describe, expect, it } from "vitest";
import { isPlausibleEmail, normalizeEmail } from "../email";

describe("email checks on the sign-up and sign-in forms", () => {
  it.each([
    "try@yahoo.com",
    "aisyah@gmail.com",
    "someone@outlook.com",
    "kedai.runcit+webbi@hotmail.my",
    "owner@kedai-aisyah.com.my",
    "x@proton.me",
    "a1@b2.co",
    "ali@kedai.xn--p1ai",
    "  spaced@yahoo.com  ",
  ])("accepts %s: free providers and short names are real addresses", (email) => {
    expect(isPlausibleEmail(email)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "aisyah",
    "aisyah@",
    "@gmail.com",
    "aisyah@gmail",
    "aisyah@@gmail.com",
    "ai syah@gmail.com",
    "aisyah@gmail.c",
    "aisyah@-gmail.com",
    "aisyah@gmail..com",
    ".aisyah@gmail.com",
    "aisyah.@gmail.com",
    "ai..syah@gmail.com",
    `${"a".repeat(65)}@gmail.com`,
    `a@${"b".repeat(250)}.com`,
  ])("refuses the typo %j", (email) => {
    expect(isPlausibleEmail(email)).toBe(false);
  });

  it("only trims: case and dots are left for Firebase", () => {
    expect(normalizeEmail("  Try.Me@Yahoo.com \n")).toBe("Try.Me@Yahoo.com");
  });
});
