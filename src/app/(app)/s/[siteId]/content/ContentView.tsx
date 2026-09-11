"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppPage } from "@/components/app/AppHeader";
import { FlowHeader, StickyFooter } from "@/components/app/FlowChrome";
import { RequireAuth } from "@/components/app/RequireAuth";
import { SiteMissing } from "@/components/app/SiteMissing";
import { Button, DashedAdd, ErrorText, Icon, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { deleteSiteImage, uploadSiteImage } from "@/lib/images/upload";
import { CATEGORIES } from "@/lib/site/categories";
import { newId, type GenerationInput, type SiteImage } from "@/lib/site/schema";
import { updateSite } from "@/lib/site/store";
import type { Site } from "@/lib/site/types";
import { useSite } from "@/lib/site/useSite";

type Item = GenerationInput["offerings"][number] & { fromDescription?: boolean };

const ACCEPT = "image/*";
const MAX_PHOTOS = 24;

/** The price box shows a fixed "RM" prefix; plain numbers are stored as "RM9.50", anything else verbatim. */
const NUMERIC = /^[\d.,]+$/;
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

export function ContentView({ siteId }: { siteId: string }) {
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
          <ContentForm site={site} />
        )}
      </AppPage>
    </RequireAuth>
  );
}

function ContentForm({ site }: { site: Site }) {
  const router = useRouter();
  const { user } = useAuth();
  const input = site.generation?.input;
  const mentioned = new Set((site.generation?.understanding?.offerings ?? []).map((o) => o.name.trim().toLowerCase()));
  const [items, setItems] = useState<Item[]>(() =>
    (input?.offerings ?? []).map((o) => ({ ...o, fromDescription: mentioned.has(o.name.trim().toLowerCase()) })),
  );
  const [photos, setPhotos] = useState<SiteImage[]>(() => input?.photos ?? []);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const itemPhotoInput = useRef<HTMLInputElement>(null);
  const itemPhotoTarget = useRef<string | null>(null);
  const category = CATEGORIES[input?.category ?? "other"];

  // Deep link without the Confirm step done → go back there.
  useEffect(() => {
    if (!input) router.replace(`/s/${site.id}/confirm`);
  }, [input, site.id, router]);

  const buildInput = useCallback(
    (nextItems: Item[], nextPhotos: SiteImage[]): GenerationInput | null => {
      if (!input) return null;
      return {
        ...input,
        offerings: nextItems
          .filter((i) => i.name.trim())
          .map(({ id, name, price, image }) => ({ id, name: name.trim(), price: price?.trim() || undefined, image })),
        photos: nextPhotos,
      };
    },
    [input],
  );

  /** Persist photos right away so an upload is never lost on refresh. */
  const persist = useCallback(
    async (nextItems: Item[], nextPhotos: SiteImage[]) => {
      const next = buildInput(nextItems, nextPhotos);
      if (!next) return;
      try {
        await updateSite(site.id, { generation: { ...site.generation, status: "understood", input: next } });
      } catch (err) {
        console.error(err);
      }
    },
    [buildInput, site.id, site.generation],
  );

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.image) void deleteSiteImage(item.image);
    setItems((list) => list.filter((i) => i.id !== id));
  };

  const addItem = () => {
    const id = newId("item");
    setItems((list) => [...list, { id, name: "", fromDescription: false }]);
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.focus());
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (!list.length) {
      setError(`You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setError(null);
    const keys = list.map(() => newId("up"));
    setUploading((u) => ({ ...u, ...Object.fromEntries(keys.map((k) => [k, 0])) }));
    let next = photos;
    for (const [index, file] of list.entries()) {
      const key = keys[index];
      try {
        const image = await uploadSiteImage(user.uid, site.id, file, (p) => setUploading((u) => ({ ...u, [key]: p })));
        next = [...next, image];
        setPhotos(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That photo couldn't be uploaded.");
      } finally {
        setUploading((u) => {
          const rest = { ...u };
          delete rest[key];
          return rest;
        });
      }
    }
    void persist(items, next);
  };

  const removePhoto = (image: SiteImage) => {
    const next = photos.filter((p) => p !== image);
    setPhotos(next);
    void deleteSiteImage(image);
    void persist(items, next);
  };

  const uploadItemPhoto = async (files: FileList | null) => {
    const id = itemPhotoTarget.current;
    const file = files?.[0];
    if (!id || !file || !user) return;
    setError(null);
    setUploading((u) => ({ ...u, [id]: 0 }));
    try {
      const image = await uploadSiteImage(user.uid, site.id, file, (p) => setUploading((u) => ({ ...u, [id]: p })));
      const previous = items.find((i) => i.id === id)?.image;
      if (previous) void deleteSiteImage(previous);
      updateItem(id, { image });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo couldn't be uploaded.");
    } finally {
      setUploading((u) => {
        const rest = { ...u };
        delete rest[id];
        return rest;
      });
    }
  };

  const build = async () => {
    const next = buildInput(items, photos);
    if (!next) return;
    if (Object.keys(uploading).length) {
      setError("Hold on, a photo is still uploading.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateSite(site.id, { generation: { ...site.generation, status: "generating", input: next, error: undefined } });
      router.push(`/s/${site.id}/generating`);
    } catch (err) {
      console.error(err);
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  };

  const isUploading = Object.keys(uploading).length > 0;

  return (
    <>
      <FlowHeader step={3} backHref={`/s/${site.id}/confirm`} backLabel="Back to details" />
      <div className="flex flex-col gap-[18px] px-5 pt-5">
        <div className="flex flex-col gap-[6px]">
          <h1 className="text-[30px] leading-[1.08] tracking-[-0.03em]">Your {category.offeringsLabel.toLowerCase()}</h1>
          <p className="text-[14px] leading-[1.5] text-muted">
            {items.length
              ? "We started with what you mentioned. Fix the prices, add or remove anything."
              : `Add the ${category.offeringsLabel.toLowerCase()} you want on your site. Prices are optional.`}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const progress = uploading[item.id];
            return (
              <div key={item.id} className="flex items-center gap-[10px] rounded-card border border-line bg-surface py-[10px] pl-2 pr-3">
                <button
                  type="button"
                  aria-label={item.image ? `Change photo for ${item.name || "item"}` : `Add photo for ${item.name || "item"}`}
                  disabled={progress !== undefined}
                  onClick={() => {
                    itemPhotoTarget.current = item.id;
                    itemPhotoInput.current?.click();
                  }}
                  className="relative flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-line-input bg-ground text-muted hover:border-navy"
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
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    placeholder="Item name"
                    maxLength={80}
                    aria-label="Item name"
                    className="w-full bg-transparent text-[15px] font-bold leading-[1.3] text-ink outline-none placeholder:font-medium placeholder:text-placeholder"
                  />
                  <span className="text-[12px] text-muted">
                    {item.fromDescription ? "Mentioned in your description" : "Added by you"}
                  </span>
                </div>
                <label className="flex h-10 items-center gap-[2px] rounded-[10px] border-[1.5px] border-line-input bg-surface px-[10px] text-[14px] font-bold focus-within:border-navy">
                  <span className="font-semibold text-muted">RM</span>
                  <input
                    value={displayPrice(item.price)}
                    onChange={(e) => updateItem(item.id, { price: storePrice(e.target.value) })}
                    placeholder="—"
                    inputMode="decimal"
                    maxLength={30}
                    aria-label="Price in Ringgit"
                    className="w-[72px] bg-transparent text-ink outline-none placeholder:text-placeholder"
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${item.name || "item"}`}
                  onClick={() => removeItem(item.id)}
                  className="-mr-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-placeholder hover:bg-ground hover:text-danger"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            );
          })}
          <DashedAdd onClick={addItem}>Add item</DashedAdd>
        </div>

        <div className="flex flex-col gap-[10px]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[20px] leading-[1.2] tracking-[-0.02em]">Photos</h2>
            <span className="text-[12px] text-muted">3–6 works best</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-input border-[1.5px] border-dashed border-navy bg-navy-tint text-[12px] font-bold text-navy disabled:opacity-45"
            >
              <Icon name="photo_library" size={26} />
              Add photos
            </button>
            {photos.map((photo, index) => (
              <div key={photo.path ?? photo.url} className="relative aspect-square overflow-hidden rounded-input bg-line">
                <Image src={photo.url} alt="" fill sizes="(max-width: 560px) 33vw, 180px" className="object-cover" unoptimized />
                {index === 0 ? (
                  <span className="absolute bottom-1.5 left-1.5 rounded-pill bg-ink/75 px-2 py-[3px] text-[10px] font-bold text-white">
                    Cover
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => removePhoto(photo)}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-white hover:bg-danger"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            {Object.entries(uploading)
              .filter(([key]) => key.startsWith("up_"))
              .map(([key, progress]) => (
                <div key={key} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-input bg-line text-navy">
                  <Spinner size={22} />
                  <span className="absolute bottom-0 left-0 h-1 bg-navy transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              ))}
          </div>
          <p className="text-[12px] leading-[1.5] text-muted">
            Tip: photos taken in daylight, close to the {category.id === "restaurant" ? "food" : "subject"}. Webbi crops and fits them for you.
          </p>
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </div>

      <input ref={photoInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { void uploadPhotos(e.target.files); e.target.value = ""; }} />
      <input ref={itemPhotoInput} type="file" accept={ACCEPT} hidden onChange={(e) => { void uploadItemPhoto(e.target.files); e.target.value = ""; }} />

      <StickyFooter>
        <Button block loading={busy} onClick={build} disabled={isUploading} className={cn(isUploading && "opacity-45")}>
          <Icon name="auto_awesome" size={20} fill className="text-amber" />
          Build my website
        </Button>
        {photos.length === 0 ? (
          <button type="button" onClick={build} disabled={busy} className="h-9 text-[13px] font-semibold text-muted hover:text-ink">
            Skip photos for now
          </button>
        ) : null}
      </StickyFooter>
    </>
  );
}
