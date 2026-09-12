import type { Metadata } from "next";
import { ReturnView } from "./ReturnView";

export const metadata: Metadata = { title: "Confirming payment" };

export default async function ReturnPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <ReturnView siteId={siteId} />;
}
