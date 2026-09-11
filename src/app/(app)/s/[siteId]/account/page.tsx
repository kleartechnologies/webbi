import type { Metadata } from "next";
import { AccountView } from "./AccountView";

export const metadata: Metadata = { title: "Create your account" };

export default async function AccountPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <AccountView siteId={siteId} />;
}
