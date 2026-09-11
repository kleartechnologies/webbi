import type { Metadata } from "next";
import { ConfirmView } from "./ConfirmView";

export const metadata: Metadata = { title: "Here's what we understood" };

export default async function ConfirmPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <ConfirmView siteId={siteId} />;
}
