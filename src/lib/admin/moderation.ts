import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { SITE_ROW_FIELDS, toSiteRowDto } from "./dto";
import { queryPage } from "./paging";
import { emailsFor } from "./users";
import { isoTime } from "./time";

/**
 * Suspended and recently restored websites, read only. Suspending and restoring
 * stay with `npm run ops:moderate` (README → Moderation and takedown).
 */
export async function moderationList(input: { limit: number; cursor?: string }) {
  const db = adminDb();
  const notes = db.collection("siteModeration");
  const [page, restored, suspendedCount] = await Promise.all([
    queryPage(
      notes.where("moderationStatus", "==", "suspended").orderBy("suspendedAt", "desc").select("moderationReason", "suspendedAt"),
      "siteModeration",
      input.cursor,
      input.limit,
    ),
    notes.where("moderationStatus", "==", "active").orderBy("restoredAt", "desc").select("restoredAt", "suspendedAt").limit(10).get(),
    notes.where("moderationStatus", "==", "suspended").count().get(),
  ]);
  const ids = [...new Set([...page.docs, ...restored.docs].map((doc) => doc.id))];
  const sites = ids.length ? await db.getAll(...ids.map((id) => db.doc(`sites/${id}`)), { fieldMask: SITE_ROW_FIELDS }) : [];
  const siteData = new Map(sites.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() ?? {}]));
  const emails = await emailsFor([...siteData.values()].map((data) => data.ownerUid));
  const site = (id: string) => {
    const data = siteData.get(id);
    return data ? toSiteRowDto(id, data, emails.get(data.ownerUid) ?? null) : null;
  };
  return {
    suspendedCount: suspendedCount.data().count,
    suspended: page.docs.map((doc) => ({
      siteId: doc.id,
      site: site(doc.id),
      reason: typeof doc.get("moderationReason") === "string" ? (doc.get("moderationReason") as string).slice(0, 500) : null,
      suspendedAt: isoTime(doc.get("suspendedAt")),
      /** A suspended website's public link shows only a generic "unavailable" notice. */
      publicPath: site(doc.id)?.slug ? `/w/${site(doc.id)!.slug}` : null,
    })),
    nextCursor: page.nextCursor,
    recentlyRestored: restored.docs.map((doc) => ({
      siteId: doc.id,
      site: site(doc.id),
      suspendedAt: isoTime(doc.get("suspendedAt")),
      restoredAt: isoTime(doc.get("restoredAt")),
    })),
  };
}
