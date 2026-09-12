import type { Metadata } from "next";
import { EditView } from "./EditView";

export const metadata: Metadata = { title: "Edit your Webbi" };

export default async function EditPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <EditView siteId={siteId} />;
}
