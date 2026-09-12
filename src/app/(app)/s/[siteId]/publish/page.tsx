import type { Metadata } from "next";
import { PublishView } from "./PublishView";

export const metadata: Metadata = { title: "Publish" };

export default async function PublishPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <PublishView siteId={siteId} />;
}
