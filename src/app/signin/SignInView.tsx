"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { AuthForm, LegalNote, type AuthMode } from "@/components/app/AuthForm";
import { Wordmark } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function SignInView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<AuthMode>(params.get("mode") === "create" ? "create" : "signin");
  const { status } = useAuth();

  // Already signed in with a real account → nothing to do here.
  useEffect(() => {
    if (status === "account") router.replace(next);
  }, [status, next, router]);

  return (
    <AppPage className="px-5 pb-safe">
      <div className="flex items-center justify-center pt-5">
        <Wordmark size={26} />
      </div>
      <div className="flex flex-col gap-6 pt-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 sm:text-[34px]">{mode === "create" ? "Create your account" : "Welcome back"}</h1>
          <p className="text-[14px] leading-[1.5] text-muted">
            {mode === "create"
              ? "So you can edit and republish anytime, from any phone."
              : "Sign in to edit, share or republish your Webbi."}
          </p>
        </div>
        <AuthForm mode={mode} onModeChange={setMode} onSuccess={() => router.replace(next)} />
      </div>
      <div className="mt-auto px-2 pb-8 pt-8">
        <LegalNote />
      </div>
    </AppPage>
  );
}
