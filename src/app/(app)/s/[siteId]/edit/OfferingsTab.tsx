"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { DashedAdd, Field, Icon, Input, Spinner, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { UPLOAD_ACCEPT } from "@/lib/images/limits";
import { uploadSiteImage } from "@/lib/images/upload";
import { CATEGORIES } from "@/lib/site/categories";
import { newId, type OfferingItem, type SiteContent } from "@/lib/site/schema";
import { IconButton, SectionHeading } from "./EditorBits";
import { defaultOfferingKind, ensureSection, findSection, moveItem, patchSection, sectionIndex } from "./sections";
import type { Issues, Update } from "./useDraft";

interface Props {
  site: SiteContent;
  update: Update;
  issues: Issues;
  siteId: string;
}

const MAX_ITEMS = 40;
const NUMERIC = /^[\d.,]+$/;
const clean = (value: string) => (value.trim() ? value : undefined);

function displayPrice(price?: string): string {
  if (!price) return "";
  const rest = price.replace(/^RM\s?/i, "");
  return NUMERIC.test(rest) ? rest : price;
}
function storePrice(text: string): string | undefined {
  const value = text.trim();
  if (!value) return undefined;
  return NUMERIC.test(value) ? `RM${value}` : text;
}

/** Products / services / menu: structured rows, no free-form layout. */
export function OfferingsTab({ site, update, issues, siteId }: Props) {
  const section = findSection(site, "offerings");
  const category = CATEGORIES[site.business.category];
  const idx = sectionIndex(site, "offerings");
  const [open, setOpen] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  if (!section) {
    return (
      <div className="flex flex-col gap-[14px]">
        <SectionHeading title={category.offeringsLabel} />
        <p className="text-[14px] leading-[1.5] text-muted">
          Your site doesn&apos;t list {category.offeringsLabel.toLowerCase()} yet. Add a section and customers can ask
          about each one on WhatsApp.
        </p>
        <DashedAdd
          onClick={() =>
            update((d) =>
              ensureSection(d, "offerings", () => ({
                type: "offerings",
                kind: defaultOfferingKind(d.business.category),
                title: category.offeringsLabel,
                items: [],
              })),
            )
          }
        >
          Add {category.offeringsLabel.toLowerCase()}
        </DashedAdd>
      </div>
    );
  }

  const items = section.items;
  const setItems = (next: OfferingItem[]) => update((d) => patchSection(d, "offerings", { items: next }));
  const patchItem = (id: string, patch: Partial<OfferingItem>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    const id = newId("item");
    setItems([...items, { id, name: "" }]);
    setOpen(id);
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.focus());
  };

  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));

  const pickPhoto = (id: string) => {
    target.current = id;
    fileInput.current?.click();
  };

  const uploadPhoto = async (files: FileList | null) => {
    const id = target.current;
    const file = files?.[0];
    if (!id || !file) return;
    setError(null);
    setUploading((u) => ({ ...u, [id]: 0 }));
    try {
      const image = await uploadSiteImage(siteId, file, (p) => setUploading((u) => ({ ...u, [id]: p })));
      update((d) => {
        const current = findSection(d, "offerings");
        if (!current) return d;
        return patchSection(d, "offerings", { items: current.items.map((i) => (i.id === id ? { ...i, image } : i)) });
      });
    } catch (err) {
      console.error(err);
      setError("That photo couldn't be uploaded. Try a smaller image.");
    } finally {
      setUploading((u) => {
        const rest = { ...u };
        delete rest[id];
        return rest;
      });
    }
  };

  const removePhoto = (id: string) => patchItem(id, { image: undefined });

  return (
    <div className="flex flex-col gap-[18px]">
      <Field label="Section title" htmlFor="off-title" error={issues[`sections.${idx}.title`]}>
        <Input
          id="off-title"
          value={section.title}
          maxLength={60}
          invalid={Boolean(issues[`sections.${idx}.title`])}
          onChange={(e) => update((d) => patchSection(d, "offerings", { title: e.target.value }))}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <SectionHeading title={`${section.title || category.offeringsLabel} items`} note={`${items.length} of ${MAX_ITEMS}`} />
        {items.map((item, index) => {
          const progress = uploading[item.id];
          const expanded = open === item.id;
          return (
            <div key={item.id} className={cn("rounded-card border bg-surface", expanded ? "border-navy" : "border-line")}>
              <div className="flex items-center gap-[10px] py-[10px] pl-2 pr-2">
                <button
                  type="button"
                  aria-label={item.image ? `Change photo for ${item.name || "item"}` : `Add photo for ${item.name || "item"}`}
                  disabled={progress !== undefined}
                  onClick={() => pickPhoto(item.id)}
                  className="relative flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-thumb border-[1.5px] border-dashed border-line-input bg-ground text-muted hover:border-navy"
                >
                  {item.image ? (
                    <Image src={item.image.url} alt="" fill sizes="52px" className="object-cover" unoptimized />
                  ) : progress !== undefined ? (
                    <Spinner size={18} className="text-navy" />
                  ) : (
                    <Icon name="add_a_photo" size={22} />
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <input
                    id={`item-${item.id}`}
                    value={item.name}
                    onChange={(e) => patchItem(item.id, { name: e.target.value })}
                    placeholder="Item name"
                    maxLength={80}
                    aria-label="Item name"
                    className="w-full bg-transparent text-[15px] font-bold leading-[1.3] text-ink outline-none placeholder:font-medium placeholder:text-placeholder"
                  />
                  <label className="flex items-center gap-[2px] text-[13px] font-bold text-navy">
                    <span className="text-muted">RM</span>
                    <input
                      value={displayPrice(item.price)}
                      onChange={(e) => patchItem(item.id, { price: storePrice(e.target.value) })}
                      placeholder="Price"
                      inputMode="decimal"
                      maxLength={30}
                      aria-label="Price in Ringgit"
                      className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:font-medium placeholder:text-placeholder"
                    />
                  </label>
                </div>
                <IconButton
                  icon={expanded ? "expand_less" : "edit"}
                  label={expanded ? "Done" : `Edit ${item.name || "item"}`}
                  tone="navy"
                  onClick={() => setOpen(expanded ? null : item.id)}
                />
                <IconButton icon="delete" label={`Remove ${item.name || "item"}`} tone="danger" onClick={() => removeItem(item.id)} />
              </div>
              {expanded ? (
                <div className="flex flex-col gap-[14px] border-t border-line px-3 pt-3 pb-3">
                  <Field label="Description" htmlFor={`desc-${item.id}`}>
                    <Textarea
                      id={`desc-${item.id}`}
                      value={item.description ?? ""}
                      maxLength={240}
                      rows={2}
                      className="min-h-[72px]"
                      onChange={(e) => patchItem(item.id, { description: clean(e.target.value) })}
                    />
                  </Field>
                  <Field label="Tag" htmlFor={`tag-${item.id}`} helper="Short label on the card, e.g. Best seller or New.">
                    <Input
                      id={`tag-${item.id}`}
                      value={item.tag ?? ""}
                      maxLength={24}
                      className="h-11 text-[15px]"
                      onChange={(e) => patchItem(item.id, { tag: clean(e.target.value) })}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setItems(moveItem(items, index, -1))}
                      className="inline-flex h-9 items-center gap-1 rounded-pill border border-line-input bg-surface px-3 text-[13px] font-semibold text-ink hover:border-navy disabled:opacity-30"
                    >
                      <Icon name="keyboard_arrow_up" size={18} /> Move up
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => setItems(moveItem(items, index, 1))}
                      className="inline-flex h-9 items-center gap-1 rounded-pill border border-line-input bg-surface px-3 text-[13px] font-semibold text-ink hover:border-navy disabled:opacity-30"
                    >
                      <Icon name="keyboard_arrow_down" size={18} /> Move down
                    </button>
                    {item.image ? (
                      <button
                        type="button"
                        onClick={() => removePhoto(item.id)}
                        className="inline-flex h-9 items-center gap-1 rounded-pill px-3 text-[13px] font-semibold text-danger hover:bg-danger-tint"
                      >
                        <Icon name="close" size={18} /> Remove photo
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {items.length < MAX_ITEMS ? <DashedAdd onClick={addItem}>Add item</DashedAdd> : null}
        {error ? <p role="alert" className="text-[12px] font-semibold text-danger">{error}</p> : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={UPLOAD_ACCEPT}
        hidden
        onChange={(e) => {
          void uploadPhoto(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
