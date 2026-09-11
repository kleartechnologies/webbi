import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/Footer";
import { LandingNav } from "@/components/landing/Nav";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <LandingNav />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-16 pt-10 sm:px-8">
        <h1 className="text-h1 sm:text-[38px]">{title}</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated {updated}</p>
        <div className="prose-webbi mt-8 flex flex-col gap-4 text-[15px] leading-[1.6] text-ink [&_h2]:mt-4 [&_h2]:text-h3 [&_h2]:font-bold">
          {children}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
