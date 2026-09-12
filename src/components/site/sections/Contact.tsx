import { Icon } from "@/components/ui/Icon";
import { mailUrl, socialLinks } from "@/lib/site/links";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionTitle } from "../Section";
import { SocialLinks, socialPlacement } from "../SocialLinks";
import type { RenderCtx } from "../context";

const outline = "inline-flex h-11 items-center justify-center gap-2 rounded-pill border-[1.5px] border-site-ink px-5 text-[14px] font-bold text-site-ink";

export function Contact({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"contact"> }) {
  const { site, strings, chat, call, target, rel } = ctx;
  const { business } = site;
  const socials = socialPlacement(ctx) === "contact" ? socialLinks(business) : [];
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
      <SocialLinks ctx={ctx} at="contact" label={strings.follow} className="pt-5" />
    </Section>
  );
}
