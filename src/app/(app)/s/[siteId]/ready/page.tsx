import type { Metadata } from "next";
import { ReadyView } from "./ReadyView";

export const metadata: Metadata = { title: "Your Webbi is ready" };

export default async function ReadyPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <ReadyView siteId={siteId} />;
}
