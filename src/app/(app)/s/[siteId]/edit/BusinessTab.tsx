"use client";

import { useState } from "react";
import { ImageUploadField } from "@/components/app/ImageUploadField";
import { DashedAdd, Field, Input, Textarea } from "@/components/ui";
import { normalizeMyPhone } from "@/lib/ai/assemble";
import { CATEGORIES } from "@/lib/site/categories";
import { socialUrl, type SocialKind } from "@/lib/site/links";
import { newId, type SiteContent, type SiteImage } from "@/lib/site/schema";
import { IconButton, SectionHeading } from "./EditorBits";
import { ensureSection, findSection, patchSection, sectionIndex } from "./sections";
import type { Issues, Update } from "./useDraft";

interface Props {
  site: SiteContent;
  update: Update;
  issues: Issues;
  uid: string;
  siteId: string;
}

const clean = (value: string) => (value.trim() ? value : undefined);

const SOCIAL_FIELDS: { kind: SocialKind; label: string; placeholder: string }[] = [
  { kind: "instagram", label: "Instagram", placeholder: "@username" },
  { kind: "facebook", label: "Facebook", placeholder: "Username or page URL" },
  { kind: "tiktok", label: "TikTok", placeholder: "@username" },
];

/** Shown under a social field whose value can't become a safe profile link. */
export const SOCIAL_HINT = "Paste your profile link or @username.";
const localPart = (whatsapp?: string) => (whatsapp ? (whatsapp.startsWith("60") ? whatsapp.slice(2) : whatsapp) : "");

/** Business, hero, about, contact details, location and opening hours. */
export function BusinessTab({ site, update, issues, uid, siteId }: Props) {
  const personLed = CATEGORIES[site.business.category].personLed;
  const hero = findSection(site, "hero");
  const about = findSection(site, "about");
  const location = findSection(site, "location");
  const heroIdx = sectionIndex(site, "hero");
  const [aboutText, setAboutText] = useState(() => (about?.body ?? []).join("\n\n"));
  const [whatsapp, setWhatsapp] = useState(() => localPart(site.business.whatsapp));
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  const setBusiness = (patch: Partial<SiteContent["business"]>) =>
    update((d) => ({ ...d, business: { ...d.business, ...patch } }));

  /**
   * The cover the hero shows: the dedicated cover photo, or on sites built
   * before it existed, the first photo. Replacing or removing writes the new
   * cover and drops the legacy one, so removing always restores the category
   * fallback.
   */
  const coverImage = site.business.heroImage ?? hero?.image;
  const onCover = (image: SiteImage | undefined) =>
    update((d) => {
      const next = { ...d, business: { ...d.business, heroImage: image, heroImagePosition: image ? d.business.heroImagePosition : undefined } };
      return findSection(next, "hero") ? patchSection(next, "hero", { image: undefined }) : next;
    });

  const onAbout = (text: string) => {
    setAboutText(text);
    const body = text.split(/\n\s*\n/).filter((p) => p.trim());
    update((d) => {
      const next = ensureSection(d, "about", () => ({ type: "about", body: [""] }));
      return patchSection(next, "about", { body: body.length ? body.slice(0, 4) : [""] });
    });
  };

  const onWhatsapp = (text: string) => {
    setWhatsapp(text);
    if (!text.trim()) {
      setWhatsappError(null);
      setBusiness({ whatsapp: undefined });
      return;
    }
    const normalized = normalizeMyPhone(text);
    if (!normalized) {
      setWhatsappError("Enter a valid Malaysian mobile number, e.g. 12-345 6789.");
      return;
    }
    setWhatsappError(null);
    setBusiness({ whatsapp: normalized });
  };

  const onAddress = (text: string) => {
    update((d) => {
      const next = { ...d, business: { ...d.business, address: clean(text) } };
      return findSection(next, "location") ? patchSection(next, "location", { address: clean(text) }) : next;
    });
  };

  const hours = location?.hours ?? [];
  const setHours = (rows: { id: string; days: string; hours: string }[]) =>
    update((d) => {
      const next = ensureSection(d, "location", () => ({ type: "location" }));
      return patchSection(next, "location", { hours: rows.length ? rows : undefined });
    });

  return (
    <div className="flex flex-col gap-[18px]">
      <Field label="Business name" htmlFor="biz-name" error={issues["business.name"]}>
        <Input
          id="biz-name"
          value={site.business.name}
          maxLength={80}
          invalid={Boolean(issues["business.name"])}
          onChange={(e) => setBusiness({ name: e.target.value })}
        />
      </Field>
      <Field label="Tagline" htmlFor="biz-tagline" helper="One line under your name.">
        <Input
          id="biz-tagline"
          value={site.business.tagline ?? ""}
          maxLength={120}
          onChange={(e) => setBusiness({ tagline: clean(e.target.value) })}
        />
      </Field>
      {personLed ? (
        <ImageUploadField kind="profile" uid={uid} siteId={siteId} value={site.business.profilePhoto} onChange={(profilePhoto) => setBusiness({ profilePhoto })} />
      ) : (
        <ImageUploadField kind="logo" uid={uid} siteId={siteId} value={site.business.logo} onChange={(logo) => setBusiness({ logo })} />
      )}
      <ImageUploadField
        kind="hero"
        uid={uid}
        siteId={siteId}
        value={coverImage}
        onChange={onCover}
        position={site.business.heroImagePosition}
        onPosition={(heroImagePosition) => setBusiness({ heroImagePosition })}
      />

      {hero ? (
        <>
          <Field label="Headline" htmlFor="hero-headline" error={issues[`sections.${heroIdx}.headline`]}>
            <Input
              id="hero-headline"
              value={hero.headline}
              maxLength={90}
              invalid={Boolean(issues[`sections.${heroIdx}.headline`])}
              onChange={(e) => update((d) => patchSection(d, "hero", { headline: e.target.value }))}
            />
          </Field>
          <Field label="Subheadline" htmlFor="hero-sub">
            <Textarea
              id="hero-sub"
              value={hero.subheadline ?? ""}
              maxLength={220}
              rows={2}
              className="min-h-[72px]"
              onChange={(e) => update((d) => patchSection(d, "hero", { subheadline: clean(e.target.value) }))}
            />
          </Field>
        </>
      ) : null}

      <Field label="About" htmlFor="about" helper="Leave a blank line between paragraphs.">
        <Textarea id="about" value={aboutText} maxLength={2800} rows={5} onChange={(e) => onAbout(e.target.value)} />
      </Field>

      <Field
        label="WhatsApp"
        htmlFor="biz-whatsapp"
        helper="Customers message this number from your site."
        error={whatsappError ?? issues["business.whatsapp"]}
      >
        <Input
          id="biz-whatsapp"
          leading="+60"
          inputMode="tel"
          value={whatsapp}
          maxLength={16}
          invalid={Boolean(whatsappError)}
          onChange={(e) => onWhatsapp(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-1 gap-[18px] @md:grid-cols-2">
        <Field label="Phone (optional)" htmlFor="biz-phone">
          <Input
            id="biz-phone"
            inputMode="tel"
            value={site.business.phone ?? ""}
            maxLength={24}
            onChange={(e) => setBusiness({ phone: clean(e.target.value) })}
          />
        </Field>
        <Field label="Email (optional)" htmlFor="biz-email" error={issues["business.email"]}>
          <Input
            id="biz-email"
            type="email"
            inputMode="email"
            value={site.business.email ?? ""}
            invalid={Boolean(issues["business.email"])}
            onChange={(e) => setBusiness({ email: clean(e.target.value.trim()) })}
          />
        </Field>
      </div>

      <Field label="Location" htmlFor="biz-address" helper="Full address, shown with a map.">
        <Input
          id="biz-address"
          value={site.business.address ?? ""}
          maxLength={240}
          onChange={(e) => onAddress(e.target.value)}
        />
      </Field>
      <Field label="Area served" htmlFor="biz-area" helper="Town or region, e.g. Kajang or Klang Valley.">
        <Input id="biz-area" value={site.business.area ?? ""} maxLength={80} onChange={(e) => setBusiness({ area: clean(e.target.value) })} />
      </Field>

      <div className="flex flex-col gap-[10px]">
        <SectionHeading title="Opening hours" note={hours.length ? `${hours.length} of 7` : "Optional"} />
        {hours.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              aria-label="Days"
              placeholder="Mon – Fri"
              value={row.days}
              maxLength={40}
              className="h-11 min-w-0 flex-1 px-3 text-[15px]"
              onChange={(e) => setHours(hours.map((h, i) => (i === index ? { ...h, days: e.target.value } : h)))}
            />
            <Input
              aria-label="Hours"
              placeholder="9am – 6pm"
              value={row.hours}
              maxLength={40}
              className="h-11 min-w-0 flex-1 px-3 text-[15px]"
              onChange={(e) => setHours(hours.map((h, i) => (i === index ? { ...h, hours: e.target.value } : h)))}
            />
            <IconButton icon="close" label="Remove hours" onClick={() => setHours(hours.filter((_, i) => i !== index))} />
          </div>
        ))}
        {hours.length < 7 ? (
          <DashedAdd onClick={() => setHours([...hours, { id: newId("hrs"), days: "", hours: "" }])}>Add hours</DashedAdd>
        ) : null}
      </div>

      <div className="flex flex-col gap-[10px]">
        <SectionHeading title="Social media" note="Optional" />
        <p className="-mt-1 text-[13px] leading-[1.45] text-muted">Add your social media so customers can find you.</p>
        <div className="grid grid-cols-1 gap-[14px]">
          {SOCIAL_FIELDS.map(({ kind, label, placeholder }) => {
            const value = site.business[kind] ?? "";
            const invalid = Boolean(value.trim()) && !socialUrl(kind, value);
            return (
              <Field key={kind} label={label} htmlFor={`biz-${kind}`} error={invalid ? SOCIAL_HINT : undefined}>
                <Input
                  id={`biz-${kind}`}
                  value={value}
                  placeholder={placeholder}
                  maxLength={120}
                  autoCapitalize="none"
                  autoCorrect="off"
                  invalid={invalid}
                  onChange={(e) => setBusiness({ [kind]: clean(e.target.value) })}
                  // Stored as the platform's canonical URL once the owner leaves the field; unusable text stays visible with the hint.
                  onBlur={(e) => setBusiness({ [kind]: socialUrl(kind, e.target.value) ?? clean(e.target.value.trim()) })}
                />
              </Field>
            );
          })}
        </div>
      </div>
    </div>
  );
}
