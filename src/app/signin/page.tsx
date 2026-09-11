import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInView } from "./SignInView";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInView />
    </Suspense>
  );
}
