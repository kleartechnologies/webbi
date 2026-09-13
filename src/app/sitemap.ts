import type { MetadataRoute } from "next";
import { INDEXED_PAGES, officialUrl } from "@/lib/seo";

/** Webbi's own public pages. Customer websites are not listed here. */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXED_PAGES.map((path) => ({ url: officialUrl(path) }));
}
