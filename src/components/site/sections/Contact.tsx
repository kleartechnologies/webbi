import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { mailUrl, socialLinks } from "@/lib/site/links";
import type { SectionOf } from "@/lib/site/schema";
import { Section, SectionHead } from "../Section";
import { SocialLinks, socialPlacement } from "../SocialLinks";
import { buttonClass, type RenderCtx } from "../context";

const text = "[overflow-wrap:anywhere]";

export function Contact({ ctx, section }: { ctx: RenderCtx; section: SectionOf<"contact"> }) {
  const { site, strings, chat, call, phone, target, rel, template, skin } = ctx;
  const { business } = site;
  const socials = socialPlacement(ctx) === "contact" ? socialLinks(business) : [];
  if (!chat && !call && !business.email && !socials.length) return null;
  const title = section.title ?? strings.contact;
  const body = section.body ?? strings.contactBody;
  const email = business.email ? mailUrl(business.email) : null;

  if (template === "bold") {
    const big = "inline-flex h-16 items-center justify-center gap-3 px-8 text-[15px] font-extrabold uppercase tracking-[0.07em]";
    const info = [
      chat ? { label: strings.whatsapp, value: phone ?? strings.chat, href: chat } : null,
      call && phone ? { label: strings.call, value: phone, href: call } : null,
      email ? { label: strings.email, value: business.email!, href: email } : null,
    ].filter((item): item is { label: string; value: string; href: string } => Boolean(item));
    return (
      <Section ctx={ctx} id={section.id} band="bg-site-accent text-white">
        <div className="flex flex-col gap-10">
          <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:items-end">
            <SectionHead ctx={ctx} id={section.id} kicker={strings.contact} title={title} note={body} dark tone="text-site-ink" />
            <div className="flex flex-col gap-3 @md:flex-row @md:flex-wrap">
              {chat ? (
                <a href={chat} target={target} rel={rel} className={cn(big, "bg-site-ink text-white")}>
                  <Icon name="chat" size={22} fill />
                  {strings.chat}
                </a>
              ) : null}
              {call ? (
                <a href={call} target={target} rel={rel} className={cn(big, "bg-white text-site-ink")}>
                  <Icon name="call" size={22} />
                  {strings.call}
                </a>
              ) : null}
              {email ? (
                <a href={email} target={target} rel={rel} className={cn(big, "border-2 border-white text-white")}>
                  <Icon name="mail" size={22} />
                  {strings.email}
                </a>
              ) : null}
            </div>
          </div>
          {info.length ? (
            <dl className="grid gap-6 border-t-2 border-white/40 pt-6 @md:grid-cols-3">
              {info.map((item) => (
                <div key={item.label} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">{item.label}</dt>
                  <dd className={cn("text-[18px] font-extrabold @3xl:text-[20px]", text)}>
                    <a href={item.href} target={target} rel={rel}>
                      {item.value}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <SocialLinks ctx={ctx} at="contact" label={strings.follow} dark />
        </div>
      </Section>
    );
  }

  if (template === "trust") {
    return (
      <Section ctx={ctx} id={section.id} band="bg-site-ink text-white">
        <div className="grid gap-8 @3xl:grid-cols-[minmax(0,1fr)_420px] @3xl:gap-16">
          <div className="flex flex-col gap-5">
            <SectionHead ctx={ctx} id={section.id} kicker={strings.contact} title={title} dark />
            <p className={cn("max-w-[56ch] text-[16px] leading-[1.6] text-[#A9BAC5]", text)}>{body}</p>
            <SocialLinks ctx={ctx} at="contact" label={strings.follow} dark />
          </div>
          <div className="flex flex-col gap-3">
            {chat ? (
              <a href={chat} target={target} rel={rel} className="inline-flex h-14 items-center justify-center gap-2 rounded-[8px] bg-site-accent px-5 text-[15px] font-semibold text-white">
                <Icon name="chat" size={20} fill />
                {strings.chat}
              </a>
            ) : null}
            {call ? (
              <a href={call} target={target} rel={rel} className="inline-flex h-14 items-center justify-between gap-2 rounded-[8px] border-[1.5px] border-[#52697A] px-5 text-[15px] font-semibold text-white">
                <span className="flex items-center gap-2">
                  <Icon name="call" size={20} />
                  {strings.call}
                </span>
                {phone ? <span className="truncate font-site-mono text-[14px] text-[#A9BAC5]">{phone}</span> : null}
              </a>
            ) : null}
            {email ? (
              <a href={email} target={target} rel={rel} className="inline-flex h-14 min-w-0 items-center justify-between gap-2 rounded-[8px] border-[1.5px] border-[#52697A] px-5 text-[15px] font-semibold text-white">
                <span className="flex items-center gap-2">
                  <Icon name="mail" size={20} />
                  {strings.email}
                </span>
                <span className="min-w-0 truncate font-site-mono text-[13px] text-[#A9BAC5]">{business.email}</span>
              </a>
            ) : null}
          </div>
        </div>
      </Section>
    );
  }

  const outline = buttonClass(ctx, "outline");
  return (
    <Section ctx={ctx} id={section.id} band={template === "bright" ? "bg-white" : undefined}>
      <div className={cn("flex flex-col gap-6", template !== "elegant" && "items-start", template === "bright" && "items-center text-center")}>
        <SectionHead ctx={ctx} id={section.id} kicker={strings.contact} title={title} center={template === "bright"} />
        <p className={cn("max-w-[56ch]", skin.note, text)}>{body}</p>
        <div className={cn("flex w-full flex-col gap-3 @md:w-auto @md:flex-row @md:flex-wrap @md:items-center", template === "bright" && "@md:justify-center")}>
          {chat ? (
            <a href={chat} target={target} rel={rel} className={buttonClass(ctx, "primary", true)}>
              <Icon name="chat" size={22} fill={skin.whatsappGreen} />
              {strings.chat}
            </a>
          ) : null}
          {call ? (
            <a href={call} target={target} rel={rel} className={outline}>
              <Icon name="call" size={20} />
              {strings.call}
            </a>
          ) : null}
          {email ? (
            <a href={email} target={target} rel={rel} className={outline}>
              <Icon name="mail" size={20} />
              {strings.email}
            </a>
          ) : null}
        </div>
        <SocialLinks ctx={ctx} at="contact" label={strings.follow} />
      </div>
    </Section>
  );
}
