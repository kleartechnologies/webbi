"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { subscribeSite } from "./store";
import type { Site } from "./types";

/** Live subscription to sites/{siteId}. undefined = loading, null = missing/not yours. */
export function useSite(siteId: string): Site | null | undefined {
  const { status } = useAuth();
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  useEffect(() => {
    if (status === "loading" || status === "signed-out") return;
    return subscribeSite(siteId, setSite, () => setSite(null));
  }, [siteId, status]);
  return site;
}
