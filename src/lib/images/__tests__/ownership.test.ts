import { describe, expect, it } from "vitest";
import { foreignImage, ownsImagePath } from "../ownership";

const mine = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/a.webp?alt=media", path: "users/u1/sites/s1/a.webp" };
const theirs = { url: "https://firebasestorage.googleapis.com/v0/b/x/o/b.webp?alt=media", path: "users/u2/sites/s9/b.webp" };

describe("image ownership", () => {
  it("accepts the caller's own folder and images without a Storage path", () => {
    expect(ownsImagePath("u1", "users/u1/sites/s1/a.webp")).toBe(true);
    expect(ownsImagePath("u1", undefined)).toBe(true);
    expect(ownsImagePath("u1", "users/u10/sites/s1/a.webp")).toBe(false);
    expect(ownsImagePath("u1", "users/u2/sites/s1/a.webp")).toBe(false);
  });

  it("flags a profile photo, gallery photo or offering image from another account", () => {
    expect(foreignImage("u1", { photos: [mine], offerings: [], profilePhoto: mine })).toBeUndefined();
    expect(foreignImage("u1", { photos: [], offerings: [], profilePhoto: theirs })).toBe(theirs);
    expect(foreignImage("u1", { photos: [mine, theirs], offerings: [], profilePhoto: undefined })).toBe(theirs);
    expect(foreignImage("u1", { photos: [], offerings: [{ id: "i", name: "x", image: theirs }], profilePhoto: mine })).toBe(theirs);
  });

  it("flags a logo or cover photo from another account, so uploads can never be attached across users", () => {
    expect(foreignImage("u1", { photos: [], offerings: [], profilePhoto: undefined, logo: mine, heroImage: mine })).toBeUndefined();
    expect(foreignImage("u1", { photos: [], offerings: [], logo: theirs })).toBe(theirs);
    expect(foreignImage("u1", { photos: [], offerings: [], heroImage: theirs })).toBe(theirs);
    expect(foreignImage("u1", { photos: [mine], offerings: [], logo: mine, heroImage: theirs })).toBe(theirs);
  });
});
