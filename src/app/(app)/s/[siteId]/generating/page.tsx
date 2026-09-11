import type { Metadata } from "next";
import { GeneratingView } from "./GeneratingView";

export const metadata: Metadata = { title: "Building your Webbi" };

export default async function GeneratingPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <GeneratingView siteId={siteId} />;
}
