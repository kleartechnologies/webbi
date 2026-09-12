"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { FlowHeader, FooterNote, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { Button, ErrorText, Field, Icon, Input, Label, Spinner } from "@/components/ui";
import { normalizeMyPhone } from "@/lib/ai/assemble";
import { cn } from "@/lib/cn";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/site/categories";
import { newId, type GenerationInput } from "@/lib/site/schema";
import { updateSite } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

interface FormState {
  category: CategoryId;
  name: string;
  tagline: string;
  whatsapp: string;
  area: string;
  hours: string;
  address: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

/** Local part of a stored 60xxxxxxxxx number, for the +60 field. */
function localPart(whatsapp?: string): string {
  if (!whatsapp) return "";
  return whatsapp.startsWith("60") ? whatsapp.slice(2) : whatsapp;
}

function initialForm(site: Site): FormState {
  const u = site.generation?.understanding;
  const i = site.generation?.input;
  return {
    category: i?.category ?? u?.category ?? "other",
    name: i?.name ?? u?.name ?? "",
    tagline: i?.tagline ?? u?.tagline ?? "",
    whatsapp: localPart(i?.whatsapp ?? u?.whatsapp),
    area: i?.area ?? u?.area ?? "",
    hours: i?.hours ?? "",
    address: i?.address ?? "",
    instagram: i?.instagram ?? "",
    facebook: i?.facebook ?? "",
    tiktok: i?.tiktok ?? "",
  };
}

const clean = (v: string) => v.trim() || undefined;

export function ConfirmView({ siteId }: { siteId: string }) {
  const site = useSite(siteId);
  return (
    <RequireAuth allow={["anonymous", "account"]}>
      <AppPage>
        {site === undefined ? (
          <div className="flex flex-1 items-center justify-center py-24 text-navy">
            <Spinner size={28} />
          </div>
        ) : site === null ? (
          <SiteMissing />
        ) : (
          <ConfirmForm site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

function ConfirmForm({ site }: { site: Site }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialForm(site));
  const [showMore, setShowMore] = useState(() => Boolean(site.generation?.input?.address || site.generation?.input?.instagram));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const understanding = site.generation?.understanding;

  // Nothing to confirm yet (e.g. deep link before the AI finished) → back to start.
  useEffect(() => {
    if (!understanding && !site.generation?.input) router.replace("/start");
  }, [understanding, site.generation?.input, router]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const readChips = understanding
    ? [
        CATEGORIES[form.category].label,
        ...understanding.highlights.slice(0, 2),
        understanding.area,
        understanding.offerings.length ? `${understanding.offerings.length} items mentioned` : null,
      ].filter((c): c is string => Boolean(c))
    : [];

  const submit = async () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Give your business a name.";
    const whatsapp = normalizeMyPhone(form.whatsapp);
    if (!form.whatsapp.trim()) next.whatsapp = "Customers need a WhatsApp number to reach you.";
    else if (!whatsapp) next.whatsapp = "Enter a valid Malaysian mobile number, e.g. 12-345 6789.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    setSaveError(null);
    const previous = site.generation?.input;
    const input: GenerationInput = {
      category: form.category,
      name: form.name.trim(),
      tagline: clean(form.tagline),
      whatsapp: whatsapp!,
      area: clean(form.area),
      address: clean(form.address),
      hours: clean(form.hours),
      instagram: clean(form.instagram),
      facebook: clean(form.facebook),
      tiktok: clean(form.tiktok),
      offerings:
        previous?.offerings ??
        (understanding?.offerings ?? []).map((o) => ({ id: newId("item"), name: o.name, price: o.price })),
      photos: previous?.photos ?? [],
      profilePhoto: previous?.profilePhoto,
    };
    try {
      await updateSite(site.id, { generation: { ...site.generation, status: "understood", input } });
      router.push(`/s/${site.id}/content`);
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <FlowHeader step={2} backHref="/start" backLabel="Back to description" />
      <div className="flex flex-col gap-4 px-5 pt-5">
        <h1 className="text-[30px] leading-[1.08] tracking-[-0.03em]">Here&apos;s what we understood</h1>

        {understanding ? (
          <div className="flex flex-col gap-[10px] rounded-[18px] bg-navy-tint px-4 py-[14px]">
            <div className="flex items-center gap-2 text-[13px] font-bold text-navy">
              <Icon name="auto_awesome" size={18} fill className="text-amber" />
              Webbi&apos;s read
            </div>
            <p className="text-[14px] leading-[1.45] text-ink">{understanding.summary}</p>
            <div className="flex flex-wrap gap-[6px]">
              {readChips.map((chip) => (
                <span key={chip} className="rounded-pill bg-surface px-3 py-[6px] text-[13px] font-semibold">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <Field label="Business type" htmlFor="category">
          <div className="relative">
            <select
              id="category"
              value={form.category}
              onChange={(e) => set("category", e.target.value as CategoryId)}
              className="h-[52px] w-full appearance-none rounded-input border-[1.5px] border-line-input bg-surface pl-4 pr-11 text-[16px] text-ink outline-none focus:border-navy focus:shadow-focus"
            >
              {CATEGORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {CATEGORIES[id].label}
                </option>
              ))}
            </select>
            <Icon name="expand_more" size={22} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </Field>

        <Field label="Business name" htmlFor="name" error={errors.name}>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} invalid={Boolean(errors.name)} maxLength={80} autoComplete="organization" />
        </Field>

        <Field
          label={
            <>
              Tagline{" "}
              {understanding?.tagline ? (
                <span className="font-medium normal-case tracking-normal text-amber">· written by Webbi</span>
              ) : null}
            </>
          }
          htmlFor="tagline"
        >
          <Input id="tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} placeholder="One line customers will remember" />
        </Field>

        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp" className="text-navy">
            WhatsApp number <span className="text-danger">*</span>
          </Label>
          <div className="flex gap-2">
            <span className="flex h-[52px] items-center rounded-input border-[1.5px] border-line-input bg-ground px-[14px] text-[16px] font-semibold text-muted">
              +60
            </span>
            <Input
              id="whatsapp"
              className="min-w-0 flex-1"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="12-345 6789"
              inputMode="tel"
              autoComplete="tel-national"
              invalid={Boolean(errors.whatsapp)}
            />
          </div>
          {errors.whatsapp ? (
            <ErrorText>{errors.whatsapp}</ErrorText>
          ) : (
            <p className="text-[12px] text-muted">Customers&apos; orders and enquiries go here.</p>
          )}
        </div>

        <Field label="Location" htmlFor="area" helper="Town or area, e.g. Kajang">
          <Input id="area" value={form.area} onChange={(e) => set("area", e.target.value)} maxLength={80} />
        </Field>

        <Field label="Opening hours" htmlFor="hours">
          <Input id="hours" value={form.hours} onChange={(e) => set("hours", e.target.value)} maxLength={120} placeholder="e.g. Mon–Sat, 8am–6pm" />
        </Field>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex h-[52px] items-center justify-between rounded-input border-[1.5px] border-dashed border-line-input px-4 text-[15px] font-semibold text-muted hover:border-navy"
        >
          <span className="flex items-center gap-2">
            <Icon name="add" size={20} />
            Address, Instagram, Facebook (optional)
          </span>
          <Icon name="expand_more" size={20} className={cn("transition-transform", showMore && "rotate-180")} />
        </button>

        {showMore ? (
          <div className="flex flex-col gap-4">
            <Field label="Full address" htmlFor="address" helper="Shown on your site with a Google Maps link.">
              <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={240} autoComplete="street-address" />
            </Field>
            <Field label="Instagram" htmlFor="instagram">
              <Input id="instagram" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} maxLength={120} placeholder="@yourbusiness" leading="instagram.com/" />
            </Field>
            <Field label="Facebook" htmlFor="facebook">
              <Input id="facebook" value={form.facebook} onChange={(e) => set("facebook", e.target.value)} maxLength={120} placeholder="yourpage" leading="facebook.com/" />
            </Field>
            <Field label="TikTok" htmlFor="tiktok">
              <Input id="tiktok" value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} maxLength={120} placeholder="@yourbusiness" leading="tiktok.com/" />
            </Field>
          </div>
        ) : null}
        {saveError ? <ErrorText>{saveError}</ErrorText> : null}
      </div>
      <StickyFooter>
        <Button block icon="arrow_forward" loading={busy} onClick={submit}>
          Looks right
        </Button>
        <FooterNote>You can change any of this later.</FooterNote>
      </StickyFooter>
    </>
  );
}
