import { AuthProvider } from "@/lib/auth/AuthProvider";

/**
 * Everything under (app) is the Webbi product: landing, onboarding, dashboard,
 * editor. It needs Firebase Auth on the client. Public customer websites live
 * under /w/[slug] outside this group and never load the Firebase SDK.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
