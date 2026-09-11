import { Wordmark } from "@/components/ui";

export function LandingFooter() {
  const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-webbi flex-wrap items-center justify-between gap-4 px-5 pt-7 pb-10 text-[13px] text-muted sm:px-6">
        <div className="flex items-center gap-2">
          <Wordmark size={20} />
          <span className="ml-1">Real businesses. Real websites.</span>
        </div>
        <div className="flex flex-wrap gap-[18px]">
          <a href="#examples" className="hover:text-ink">Examples</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
          {supportWhatsApp ? (
            <a href={`https://wa.me/${supportWhatsApp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
              WhatsApp support
            </a>
          ) : null}
        </div>
        <span>© {new Date().getFullYear()} Webbi</span>
      </div>
    </footer>
  );
}
