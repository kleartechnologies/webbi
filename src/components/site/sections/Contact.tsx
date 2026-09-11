import { Icon } from "@/components/ui/Icon";
import { mailUrl, socialUrl } from "@/lib/site/links";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionTitle } from "../Section";
import type { RenderCtx } from "../context";

const outline = "inline-flex h-11 items-center justify-center gap-2 rounded-pill border-[1.5px] border-site-ink px-5 text-[14px] font-bold text-site-ink";

export function Contact({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"contact"> }) {
  const { site, strings, chat, call, target, rel } = ctx;
  const { business } = site;
  const socials: { label: string; url: string }[] = [];
  for (const [label, url] of [
    ["Instagram", socialUrl("instagram", business.instagram)],
    ["Facebook", socialUrl("facebook", business.facebook)],
    ["TikTok", socialUrl("tiktok", business.tiktok)],
  ] as const) {
    if (url) socials.push({ label, url });
  }
  if (!chat && !call && !business.email && !socials.length) return null;

  return (
    <Section id={section.id}>
      <SectionTitle ctx={ctx}>{section.title ?? strings.contact}</SectionTitle>
      <p className="mb-4 text-[15px] leading-[1.5] text-site-muted">{section.body ?? strings.contactBody}</p>
      <div className="flex flex-col gap-[10px] @md:flex-row @md:flex-wrap @md:items-center">
        {chat ? (
          <a href={chat} target={target} rel={rel} className="flex h-[54px] items-center justify-center gap-[10px] rounded-pill bg-whatsapp px-6 text-[17px] font-bold text-white">
            <Icon name="chat" size={24} fill />
            {strings.chat}
          </a>
        ) : null}
        {call ? (
          <a href={call} target={target} rel={rel} className={outline}>
            <Icon name="call" size={18} />
            {strings.call}
          </a>
        ) : null}
        {business.email ? (
          <a href={mailUrl(business.email)} target={target} rel={rel} className={outline}>
            <Icon name="mail" size={18} />
            {strings.email}
          </a>
        ) : null}
      </div>
      {socials.length ? (
        <div className="flex flex-wrap gap-2 pt-4">
          {socials.map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-pill border border-site-line bg-white px-3 text-[13px] font-semibold">
              {label}
              <Icon name="arrow_outward" size={16} />
            </a>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
