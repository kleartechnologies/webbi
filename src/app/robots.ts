import type { MetadataRoute } from "next";
import { OFFICIAL_ORIGIN } from "@/lib/seo";

/** Crawl everything public, customer websites under /w/ included; skip the API and signed-in product screens. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/s/"] },
    sitemap: `${OFFICIAL_ORIGIN}/sitemap.xml`,
  };
}
