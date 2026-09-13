"use client";

import { Chip, Field, Icon, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/site/categories";
import { PRESETS, presetStyle } from "@/lib/site/presets";
import { CTA_KINDS, type Cta, type SiteContent } from "@/lib/site/schema";
import { resolveTemplateId, switchTemplate, TEMPLATE_IDS } from "@/lib/site/templates";
import { SectionHeading } from "./EditorBits";
import type { Issues, Update } from "./useDraft";

interface Props {
  site: SiteContent;
  update: Update;
  issues: Issues;
}

/** Accent swatches from the design (06 · Editor). */
const ACCENTS: { hex: string; label: string }[] = [
  { hex: "#B4472B", label: "Terracotta" },
  { hex: "#0E6B63", label: "Teal" },
  { hex: "#1D3A8A", label: "Navy" },
  { hex: "#A8546A", label: "Rose" },
  { hex: "#E7A33E", label: "Amber" },
  { hex: "#1C1C1E", label: "Black" },
];

const KIND_LABELS: Record<Cta["kind"], string> = {
  whatsapp: "WhatsApp",
  call: "Call",
  email: "Email",
  link: "Link",
};

const clean = (value: string) => (value.trim() ? value : undefined);

/** Template, accent colour and the main button. Everything stays inside the design system. */
export function StyleTab({ site, update, issues }: Props) {
  const category = CATEGORIES[site.business.category];
  const template = resolveTemplateId(site);
  const preset = PRESETS[template];
  const accent = site.theme.accent;
  const setTheme = (patch: Partial<SiteContent["theme"]>) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const setCta = (patch: Partial<Cta>) => update((d) => ({ ...d, cta: { ...d.cta, ...patch } }));

  const labelOptions = Array.from(new Set([category.cta, "Chat on WhatsApp", "Call us", "Enquire now"]));

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-[10px]">
        <SectionHeading title="Template" note={`${PRESETS[category.preset].label} suits ${category.label.toLowerCase()}`} />
        <p className="text-[12px] text-muted">
          Changes only how your website looks. Your words, photos, AI credits, payment and live status stay exactly as they are.
        </p>
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2" role="group" aria-label="Template">
          {TEMPLATE_IDS.map((id) => {
            const p = PRESETS[id];
            const selected = id === template;
            return (
              <button
                key={id}
                type="button"
                data-template={id}
                aria-pressed={selected}
                // The only thing a template switch writes: theme.preset in the draft.
                onClick={() => update((d) => switchTemplate(d, id))}
                style={presetStyle(p, accent)}
                className={cn(
                  "flex flex-col gap-[6px] rounded-card border-[1.5px] bg-surface px-4 py-3 text-left transition-colors",
                  selected ? "border-navy shadow-focus" : "border-line hover:border-line-input",
                )}
              >
                <span className="flex items-center justify-between text-[12px] font-bold text-ink">
                  {p.label}
                  {selected ? <Icon name="check_circle" size={18} fill className="text-navy" /> : null}
                </span>
                <span
                  className={cn("text-[20px] leading-[1.15] tracking-[-0.01em]", p.heroDark ? "uppercase" : "")}
                  style={{ fontFamily: p.font, color: p.heroDark ? p.ink : p.accent }}
                >
                  {site.business.name || "Your business"}
                </span>
                <span className="text-[12px] text-muted">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[10px]">
        <SectionHeading title="Accent colour" note={accent ? "Custom" : `${preset.label} default`} />
        <div className="flex flex-wrap items-center gap-[10px]">
          <button
            type="button"
            aria-label={`Use the ${preset.label} default colour`}
            aria-pressed={!accent}
            onClick={() => setTheme({ accent: undefined })}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-[2.5px]",
              !accent ? "border-navy" : "border-transparent",
            )}
          >
            <span className="h-8 w-8 rounded-full border border-white/60" style={{ background: preset.accent }} />
          </button>
          {ACCENTS.map((a) => {
            const selected = accent?.toLowerCase() === a.hex.toLowerCase();
            return (
              <button
                key={a.hex}
                type="button"
                aria-label={a.label}
                aria-pressed={selected}
                onClick={() => setTheme({ accent: a.hex })}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-[2.5px]",
                  selected ? "border-navy" : "border-transparent",
                )}
              >
                <span className="h-8 w-8 rounded-full" style={{ background: a.hex }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-[14px]">
        <SectionHeading title="Main button" note="Shown on every screen" />
        <div className="flex flex-wrap gap-2">
          {labelOptions.map((label) => (
            <Chip key={label} selected={site.cta.label === label} onClick={() => setCta({ label })}>
              {label}
            </Chip>
          ))}
        </div>
        <Field label="Button text" htmlFor="cta-label" error={issues["cta.label"]}>
          <Input
            id="cta-label"
            value={site.cta.label}
            maxLength={40}
            invalid={Boolean(issues["cta.label"])}
            onChange={(e) => setCta({ label: e.target.value })}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-label font-bold uppercase text-muted">Button opens</span>
          <div className="flex flex-wrap gap-2">
            {CTA_KINDS.map((kind) => (
              <Chip key={kind} selected={site.cta.kind === kind} onClick={() => setCta({ kind })}>
                {KIND_LABELS[kind]}
              </Chip>
            ))}
          </div>
          {site.cta.kind === "whatsapp" && !site.business.whatsapp ? (
            <p className="text-[12px] font-semibold text-danger">Add your WhatsApp number in the Business tab.</p>
          ) : null}
          {site.cta.kind === "call" && !site.business.phone && !site.business.whatsapp ? (
            <p className="text-[12px] font-semibold text-danger">Add a phone number in the Business tab.</p>
          ) : null}
          {site.cta.kind === "email" && !site.business.email ? (
            <p className="text-[12px] font-semibold text-danger">Add your email in the Business tab.</p>
          ) : null}
        </div>
        {site.cta.kind === "whatsapp" ? (
          <Field label="Pre-filled message" htmlFor="cta-message" helper="What customers send when they tap the button.">
            <Textarea
              id="cta-message"
              value={site.cta.message ?? ""}
              maxLength={300}
              rows={2}
              className="min-h-[72px]"
              onChange={(e) => setCta({ message: clean(e.target.value) })}
            />
          </Field>
        ) : null}
        {site.cta.kind === "link" ? (
          <Field label="Link" htmlFor="cta-href" error={issues["cta.href"]}>
            <Input
              id="cta-href"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={site.cta.href ?? ""}
              invalid={Boolean(issues["cta.href"])}
              onChange={(e) => setCta({ href: clean(e.target.value.trim()) })}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
