import { ButtonLink, Icon, type IconName } from "@/components/ui";
import { CATEGORIES } from "@/lib/site/categories";
import { PRESETS } from "@/lib/site/presets";

function Eyebrow({ children, className = "text-muted" }: { children: string; className?: string }) {
  return <span className={`text-[12px] font-bold uppercase tracking-[0.12em] ${className}`}>{children}</span>;
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[clamp(30px,4vw,42px)] leading-[1.08] tracking-[-0.03em] text-pretty">{children}</h2>;
}

/* ------------------------------------------------------------------ */

const STEPS: Array<{ n: string; icon: IconName; title: string; body: string }> = [
  {
    n: "01",
    icon: "chat_bubble",
    title: "Tell us what you do",
    body: "One sentence is enough. “Saya jual nasi lemak di Kajang” or “I'm a Proton sales advisor in Shah Alam.” BM or English.",
  },
  {
    n: "02",
    icon: "fact_check",
    title: "Check the details",
    body: "Webbi fills in your name, tagline, menu or services and hours. You confirm, add your WhatsApp number and a few photos.",
  },
  {
    n: "03",
    icon: "rocket_launch",
    title: "Publish and share",
    body: "See your finished website, make simple edits, pay once and go live at webbi.my/w/your-business. Share the link or print the QR.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto flex w-full max-w-webbi flex-col gap-7 px-5 py-10 sm:px-6">
      <div className="flex max-w-[640px] flex-col gap-2">
        <Eyebrow>How it works</Eyebrow>
        <H2>Three steps. No design skills.</H2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
        {STEPS.map((s) => (
          <div key={s.n} className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-6">
            <span className="font-mono text-[13px] font-bold text-muted">{s.n}</span>
            <Icon name={s.icon} size={32} className="text-navy" />
            <strong className="text-[20px] tracking-[-0.01em]">{s.title}</strong>
            <p className="text-[15px] leading-[1.55] text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const EXAMPLE_CHIPS = [
  CATEGORIES.restaurant.label,
  CATEGORIES.car.label,
  CATEGORIES.beauty.label,
  CATEGORIES.homeServices.label,
  CATEGORIES.photographer.label,
  CATEGORIES.property.label,
  CATEGORIES.tutor.label,
  CATEGORIES.retail.label,
];

interface ExampleCard {
  name: string;
  kind: string;
  cta: string;
  ctaIcon: IconName;
  ctaFill?: boolean;
  accent: string;
  ground: string;
  stripeA: string;
  stripeB: string;
  font: string;
  titleClass: string;
  titleColor: string;
  overlay?: boolean;
}

const EXAMPLES: ExampleCard[] = [
  {
    name: "Rasa Kampung",
    kind: "Restaurant",
    cta: CATEGORIES.restaurant.cta,
    ctaIcon: "chat",
    ctaFill: true,
    accent: "#0F8742",
    ground: PRESETS.warm.ground,
    stripeA: "#5A3B2A",
    stripeB: "#4E3224",
    font: PRESETS.warm.font,
    titleClass: "text-[24px] leading-[1.1] font-bold",
    titleColor: "#fff",
    overlay: true,
  },
  {
    name: "Hafiz Rahman",
    kind: "Car sales advisor",
    cta: CATEGORIES.car.cta,
    ctaIcon: "directions_car",
    accent: PRESETS.bold.accent,
    ground: PRESETS.bold.ground,
    stripeA: "#2A2E38",
    stripeB: "#232730",
    font: PRESETS.bold.font,
    titleClass: "text-[26px] leading-none font-extrabold uppercase",
    titleColor: "#fff",
  },
  {
    name: "Sereni",
    kind: "Beauty studio",
    cta: CATEGORIES.beauty.cta,
    ctaIcon: "calendar_month",
    accent: PRESETS.elegant.accent,
    ground: PRESETS.elegant.ground,
    stripeA: "#E8CFD1",
    stripeB: "#E1C4C7",
    font: PRESETS.elegant.font,
    titleClass: "text-[28px] leading-none font-normal",
    titleColor: PRESETS.elegant.ink,
  },
  {
    name: "SejukTech",
    kind: "Aircond services",
    cta: CATEGORIES.homeServices.cta,
    ctaIcon: "request_quote",
    accent: PRESETS.trust.accent,
    ground: PRESETS.trust.ground,
    stripeA: "#C9D6E8",
    stripeB: "#BFCDE1",
    font: PRESETS.trust.font,
    titleClass: "text-[24px] leading-[1.1] font-extrabold tracking-[-0.02em]",
    titleColor: PRESETS.trust.ink,
  },
];

export function Examples() {
  return (
    <section id="examples" className="border-y border-line bg-surface">
      <div className="mx-auto flex w-full max-w-webbi flex-col gap-7 px-5 py-16 sm:px-6">
        <div className="flex max-w-[640px] flex-col gap-2">
          <Eyebrow>Examples</Eyebrow>
          <H2>Built for your kind of business</H2>
          <p className="text-[16px] leading-[1.55] text-muted">
            A restaurant doesn&apos;t need the same website as a car advisor. Webbi picks the sections, the look and the button your customers actually press.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((c) => (
            <span key={c} className="flex h-9 items-center rounded-pill bg-ground px-[14px] text-[13px] font-semibold">
              {c}
            </span>
          ))}
          <span className="flex h-9 items-center rounded-pill border border-dashed border-line-input px-[14px] text-[13px] font-semibold text-muted">
            + any small business
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-[14px]">
          {EXAMPLES.map((e) => (
            <div
              key={e.name}
              className="flex flex-col overflow-hidden rounded-panel border border-line transition-colors hover:border-ink"
              style={{ background: e.ground }}
            >
              <div
                className="relative flex aspect-[4/3] items-end p-4"
                style={{ background: `repeating-linear-gradient(135deg,${e.stripeA} 0 12px,${e.stripeB} 12px 24px)` }}
              >
                {e.overlay ? (
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(30,18,10,0)_30%,rgba(30,18,10,.85)_100%)]" />
                ) : null}
                <span className={`relative ${e.titleClass}`} style={{ fontFamily: e.font, color: e.titleColor }}>
                  {e.name}
                </span>
              </div>
              <div className="flex flex-col gap-2 px-4 pt-[14px] pb-4">
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{e.kind}</span>
                <span
                  className="flex h-[34px] items-center gap-1.5 self-start rounded-pill px-3 text-[13px] font-bold text-white"
                  style={{ background: e.accent }}
                >
                  <Icon name={e.ctaIcon} size={16} fill={e.ctaFill} />
                  {e.cta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Minus() {
  return <Icon name="remove" size={20} className="shrink-0 text-[#B9BCCB]" />;
}
function Check({ className = "text-success" }: { className?: string }) {
  return <Icon name="check_circle" size={20} fill className={`shrink-0 ${className}`} />;
}

export function WhyWebbi() {
  return (
    <section className="mx-auto flex w-full max-w-webbi flex-col gap-7 px-5 pt-16 pb-10 sm:px-6">
      <div className="flex max-w-[640px] flex-col gap-2">
        <Eyebrow>Why Webbi</Eyebrow>
        <H2>Easier than an agency. Faster than doing it yourself.</H2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[14px]">
        <div className="flex flex-col gap-[14px] rounded-panel border border-line bg-surface p-6">
          <span className="text-[13px] font-bold text-muted">Hiring an agency</span>
          <ul className="flex flex-col gap-[10px] text-[15px] leading-[1.5] text-muted">
            <li className="flex gap-[10px]"><Minus />RM 2,000 – 5,000 upfront</li>
            <li className="flex gap-[10px]"><Minus />2 – 4 weeks, revisions over email</li>
            <li className="flex gap-[10px]"><Minus />Pay again for every change</li>
          </ul>
        </div>
        <div className="flex flex-col gap-[14px] rounded-panel border border-line bg-surface p-6">
          <span className="text-[13px] font-bold text-muted">DIY website builders</span>
          <ul className="flex flex-col gap-[10px] text-[15px] leading-[1.5] text-muted">
            <li className="flex gap-[10px]"><Minus />Hours dragging boxes around</li>
            <li className="flex gap-[10px]"><Minus />Templates that look like templates</li>
            <li className="flex gap-[10px]"><Minus />RM 60 – 120 every month, forever</li>
          </ul>
        </div>
        <div className="flex flex-col gap-[14px] rounded-panel border-2 border-navy bg-navy-tint p-6">
          <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-navy">
            <span className="font-display text-[16px] font-extrabold tracking-[-0.02em]">Webbi</span>
            <span className="h-[5px] w-[5px] rounded-full bg-amber" />
          </span>
          <ul className="flex flex-col gap-[10px] text-[15px] leading-[1.5] text-ink">
            <li className="flex gap-[10px]"><Check />RM149.90, once. No monthly fee.</li>
            <li className="flex gap-[10px]"><Check />Describe your business, done in minutes</li>
            <li className="flex gap-[10px]"><Check />Looks like a real website, made for your trade</li>
            <li className="flex gap-[10px]"><Check />Edit anytime from your phone</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const CTA_CHIPS = [
  CATEGORIES.restaurant.cta,
  CATEGORIES.car.cta,
  CATEGORIES.homeServices.cta,
  CATEGORIES.beauty.cta,
  CATEGORIES.tutor.cta,
  CATEGORIES.photographer.cta,
];

export function WhatsAppSection() {
  return (
    <section className="mx-auto w-full max-w-webbi px-5 pt-10 pb-16 sm:px-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-center gap-9 rounded-sheet bg-ink p-[clamp(28px,5vw,56px)] text-white">
        <div className="flex flex-col gap-4">
          <Eyebrow className="text-amber">Made for WhatsApp</Eyebrow>
          <H2>Customers don&apos;t fill in forms. They WhatsApp you.</H2>
          <p className="max-w-[520px] text-[16px] leading-[1.55] text-white/75">
            Every Webbi site has one big button pinned to the bottom of the screen, and it says what your customers want to do. One tap opens a chat with you, message pre-written.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CTA_CHIPS.map((c) => (
              <span key={c} className="flex h-8 items-center rounded-pill bg-white/10 px-3 text-[13px] font-semibold">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex w-full max-w-[380px] flex-col gap-3 justify-self-center">
          <div className="flex flex-col gap-[10px] rounded-[20px] bg-surface p-[14px] text-ink shadow-[0_20px_50px_rgba(0,0,0,.3)]">
            <div className="flex items-center gap-[10px]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B4472B] font-lora text-[15px] font-bold text-white">R</span>
              <div className="flex flex-col">
                <strong className="text-[14px]">Rasa Kampung</strong>
                <span className="text-[12px] text-muted">online</span>
              </div>
            </div>
            <div className="max-w-[85%] self-end rounded-[16px_16px_4px_16px] bg-success-tint px-3 py-[10px] text-[14px] leading-[1.45]">
              Hi Rasa Kampung, nak order 2 × Nasi Lemak Ayam Berempah untuk pickup 12:30 👋
            </div>
            <div className="max-w-[85%] self-start rounded-[16px_16px_16px_4px] bg-ground px-3 py-[10px] text-[14px] leading-[1.45]">
              Boleh! Siap 12:30, RM19. Terima kasih 🙏
            </div>
          </div>
          <div className="flex gap-[10px] rounded-[20px] bg-[rgba(251,247,240,.96)] p-[10px]">
            <span className="flex h-12 flex-1 items-center justify-center gap-2 rounded-pill bg-whatsapp text-[15px] font-bold text-white">
              <Icon name="chat" size={20} fill />
              Order on WhatsApp
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-pill border-[1.5px] border-[#2B1F16] text-[#2B1F16]">
              <Icon name="call" size={20} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const PRICING_POINTS = [
  "Your own link: webbi.my/w/your-business",
  "Mobile-first website, hosting included",
  "WhatsApp, call and enquiry buttons",
  "Unlimited edits, republish anytime",
  "QR code for your shop and flyers",
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto grid w-full max-w-webbi grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-center gap-10 px-5 pt-6 pb-16 sm:px-6">
      <div className="flex flex-col gap-3">
        <Eyebrow>Pricing</Eyebrow>
        <H2>One price. No surprises.</H2>
        <p className="max-w-[480px] text-[16px] leading-[1.55] text-muted">
          Preview your website free. Pay only when you&apos;re ready to publish. No monthly fees, no renewals, no upsells.
        </p>
      </div>
      <div className="flex flex-col gap-[22px] rounded-sheet bg-navy px-8 py-9 text-white shadow-[0_24px_60px_rgba(34,48,122,.25)]">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-amber">One-time payment</span>
          <span className="font-display text-[clamp(52px,8vw,72px)] leading-none font-extrabold tracking-[-0.04em]">RM149.90</span>
          <span className="text-[18px] font-semibold">One website. Lifetime access.</span>
        </div>
        <ul className="flex flex-col gap-[10px] text-[15px] leading-[1.4]">
          {PRICING_POINTS.map((p) => (
            <li key={p} className="flex items-center gap-[10px]">
              <Check className="text-amber" />
              {p}
            </li>
          ))}
        </ul>
        <ButtonLink href="/start" icon="arrow_forward" className="h-14 bg-surface text-[17px] text-navy hover:bg-navy-tint">
          Create My Website
        </ButtonLink>
        <span className="text-center text-[13px] text-white/65">Pay once by FPX or card. Extra websites RM149.90 each.</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-webbi px-5 py-16 sm:px-6">
      <div className="flex flex-col items-center gap-5 rounded-sheet bg-navy p-[clamp(32px,6vw,64px)] text-center text-white">
        <h2 className="max-w-[720px] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.035em] text-pretty">
          Your business deserves a proper website. Tell us what you do.
        </h2>
        <p className="text-[17px] text-white/75">Free to try. RM149.90 when you publish.</p>
        <ButtonLink href="/start" variant="amber" icon="arrow_forward" className="h-[58px] px-[30px] text-[17px] font-extrabold hover:bg-[#F0B458]">
          Create My Website
        </ButtonLink>
      </div>
    </section>
  );
}
