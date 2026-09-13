"use client";

import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { useLandingCopy } from "./i18n/LandingLanguage";
import { NavAuthLink } from "./NavAuthLink";

const LINK = "transition-colors hover:text-white";

export function LandingFooter({ landing = false }: { landing?: boolean }) {
  const copy = useLandingCopy();
  const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const anchor = (id: string) => (landing ? `#${id}` : `/#${id}`);
  return (
    <footer className="relative z-10 bg-ink px-4 pt-9 pb-11 text-white/70">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-5">
        <Wordmark href={landing ? "#top" : "/"} size={24} label={copy.nav.home} className="text-white!" />
        <nav aria-label={copy.footer.label} className="flex flex-wrap items-center gap-x-[22px] gap-y-2 text-[14px] font-semibold">
          <a href={anchor("how")} className={LINK}>{copy.nav.how}</a>
          <a href={anchor("examples")} className={LINK}>{copy.nav.examples}</a>
          <a href={anchor("pricing")} className={LINK}>{copy.nav.pricing}</a>
          <Link href="/terms" className={LINK}>{copy.footer.terms}</Link>
          <Link href="/privacy" className={LINK}>{copy.footer.privacy}</Link>
          {supportWhatsApp ? (
            <a href={`https://wa.me/${supportWhatsApp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className={LINK}>
              {copy.footer.support}
            </a>
          ) : null}
          <NavAuthLink className={LINK} />
        </nav>
        <span className="text-[13px]">© {new Date().getFullYear()} Webbi · {copy.footer.built}</span>
      </div>
    </footer>
  );
}
