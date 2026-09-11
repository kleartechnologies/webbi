import type { Metadata } from "next";
import { ContentView } from "./ContentView";

export const metadata: Metadata = { title: "Your content" };

export default async function ContentPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <ContentView siteId={siteId} />;
}
