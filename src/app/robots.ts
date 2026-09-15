import type { MetadataRoute } from "next";
import { OFFICIAL_ORIGIN } from "@/lib/seo";

/** Crawl everything public, customer websites under /w/ included; skip the API, signed-in product screens and the owner's admin panel. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/s/", "/admin"] },
    sitemap: `${OFFICIAL_ORIGIN}/sitemap.xml`,
  };
}
