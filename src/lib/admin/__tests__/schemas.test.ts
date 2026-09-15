import { ZodError } from "zod";
import { describe, expect, it } from "vitest";
import {
  emptyQuery,
  moderationQuery,
  overviewQuery,
  paymentsQuery,
  searchParamsOf,
  siteDetailQuery,
  siteIdParam,
  sitesQuery,
  systemCheckBody,
  uidParam,
  usersQuery,
} from "../schemas";

const q = (query: string) => searchParamsOf(new Request(`https://webbi.online/api/admin/x?${query}`));

describe("admin query validation", () => {
  it("defaults to 25 and allows at most 50 a page", () => {
    expect(usersQuery.parse({}).limit).toBe(25);
    expect(sitesQuery.parse(q("limit=50")).limit).toBe(50);
    for (const limit of ["51", "0", "-1", "1.5", "abc", "1e3"]) {
      expect(() => sitesQuery.parse(q(`limit=${limit}`)), limit).toThrow(ZodError);
      expect(() => usersQuery.parse(q(`limit=${limit}`)), limit).toThrow(ZodError);
      expect(() => paymentsQuery.parse(q(`limit=${limit}`)), limit).toThrow(ZodError);
      expect(() => moderationQuery.parse(q(`limit=${limit}`)), limit).toThrow(ZodError);
    }
  });

  it("rejects malformed cursors", () => {
    for (const cursor of ["../payments", "a/b", "x".repeat(129), "a b", "%00"]) {
      expect(() => sitesQuery.parse(q(`cursor=${encodeURIComponent(cursor)}`)), cursor).toThrow(ZodError);
      expect(() => paymentsQuery.parse(q(`cursor=${encodeURIComponent(cursor)}`)), cursor).toThrow(ZodError);
    }
    expect(() => usersQuery.parse(q(`cursor=${encodeURIComponent("a b<script>")}`))).toThrow(ZodError);
    expect(sitesQuery.parse(q("cursor=abc_DEF-123")).cursor).toBe("abc_DEF-123");
  });

  it("rejects unknown filters and views, including 'unpublished'", () => {
    expect(() => sitesQuery.parse(q("filter=unpublished"))).toThrow(ZodError);
    expect(() => sitesQuery.parse(q("filter=ALL"))).toThrow(ZodError);
    expect(() => paymentsQuery.parse(q("view=refunded"))).toThrow(ZodError);
    expect(sitesQuery.parse(q("filter=paid_not_live")).filter).toBe("paid_not_live");
    expect(paymentsQuery.parse(q("view=refund")).view).toBe("refund");
  });

  it("rejects unknown and repeated parameters", () => {
    expect(() => sitesQuery.parse(q("filter=all&orderBy=email"))).toThrow(ZodError);
    expect(() => emptyQuery.parse(q("x=1"))).toThrow(ZodError);
    expect(() => overviewQuery.parse(q("refresh=true"))).toThrow(ZodError);
    expect(() => siteDetailQuery.parse(q("section=draft"))).toThrow(ZodError);
    expect(() => q("limit=10&limit=50")).toThrow(ZodError);
  });

  it("accepts only plain ids in paths", () => {
    expect(() => uidParam.parse("../users")).toThrow(ZodError);
    expect(() => siteIdParam.parse("a/b")).toThrow(ZodError);
    expect(siteIdParam.parse("AbC123")).toBe("AbC123");
  });
});

describe("system checks", () => {
  it("accept exactly openai, billplz or storage", () => {
    for (const service of ["openai", "billplz", "storage"]) expect(systemCheckBody.parse({ service }).service).toBe(service);
  });

  it("refuse URLs, other services and extra fields", () => {
    for (const body of [
      { service: "https://example.com" },
      { service: "firestore" },
      { service: "openai", url: "https://evil.example" },
      { url: "https://evil.example" },
      null,
      "openai",
    ]) {
      expect(() => systemCheckBody.parse(body), JSON.stringify(body)).toThrow(ZodError);
    }
  });
});
