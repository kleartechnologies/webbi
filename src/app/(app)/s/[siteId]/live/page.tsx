import type { Metadata } from "next";
import { LiveView } from "./LiveView";

export const metadata: Metadata = { title: "You're live" };

export default async function LivePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <LiveView siteId={siteId} />;
}
