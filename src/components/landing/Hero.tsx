import { ButtonLink, Icon } from "@/components/ui";
import { HeroPhone } from "./HeroPhone";

const HERO_PROMPT =
  "Saya buka kedai makan di Kajang, jual nasi lemak dan lauk kampung. Customer biasa order ikut WhatsApp.";

const CHECKS = ["RM149.90, one time", "Live in minutes", "WhatsApp-ready"];

export function Hero() {
  return (
    <section
      id="top"
      className="mx-auto grid w-full max-w-webbi grid-cols-1 items-center gap-10 px-5 pt-12 pb-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="flex max-w-[560px] flex-col gap-[22px]">
        <span className="inline-flex h-8 items-center gap-2 self-start rounded-pill border border-line bg-surface pr-3 pl-2 text-[13px] font-semibold text-muted">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-amber text-ink">
            <Icon name="auto_awesome" size={12} fill />
          </span>
          Websites for Malaysian small businesses
        </span>
        <h1 className="text-[clamp(40px,6vw,64px)] leading-[1.02] tracking-[-0.035em] text-pretty">
          Tell us what you do. We&apos;ll build your website.
        </h1>
        <p className="text-[19px] leading-[1.5] text-muted text-pretty">
          Professional websites for businesses, creators and salespeople, without the hassle.
        </p>
        <div className="flex flex-wrap gap-[10px]">
          <ButtonLink href="/start" icon="arrow_forward" className="h-14 px-[26px] text-[17px]">
            Create My Website
          </ButtonLink>
          <ButtonLink href="#examples" variant="secondary" className="h-14 px-6 text-[17px]">
            See Examples
          </ButtonLink>
        </div>
        <div className="flex flex-wrap gap-x-[18px] gap-y-2 text-[14px] text-muted">
          {CHECKS.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <Icon name="check_circle" size={18} fill className="text-success" />
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-[14px] justify-self-center">
        <div className="flex w-full max-w-[330px] flex-col gap-[10px] rounded-[20px] border border-line bg-surface px-[18px] py-4 shadow-[0_10px_30px_rgba(20,26,59,.08)]">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">What do you do?</span>
          <p className="text-[16px] leading-[1.5] text-ink">“{HERO_PROMPT}”</p>
          <div className="flex items-center gap-2 text-[13px] font-bold text-navy">
            <Icon name="auto_awesome" size={18} fill className="text-amber" />
            Webbi built this in under a minute
            <Icon name="arrow_downward" size={18} className="ml-auto" />
          </div>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}
