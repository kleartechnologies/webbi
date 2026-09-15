import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { AuthProvider } from "@/lib/auth/AuthProvider";

/**
 * Webbi's owner panel. The HTML is the same empty shell for everyone: no
 * customer data and no panel markup. AdminGate asks /api/admin/session and
 * renders the panel only for the owner; each view then loads its data from
 * /api/admin/*, which authorizes every request (src/lib/admin/auth.ts).
 * Served only on ADMIN_HOSTS (src/proxy.ts).
 */
export const metadata: Metadata = {
  title: { absolute: "Webbi" },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminGate>{children}</AdminGate>
    </AuthProvider>
  );
}
