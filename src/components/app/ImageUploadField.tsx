"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button, ErrorText, Icon, Label, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";
import { deleteSiteImage, uploadSiteImage } from "@/lib/images/upload";
import { HERO_IMAGE_POSITIONS, type HeroImagePosition, type SiteImage } from "@/lib/site/schema";

/**
 * One optional image with an immediate preview and Replace / Remove.
 *
 * - "profile": the person behind a person-led business (round)
 * - "logo":    a business-led business's logo (square)
 * - "hero":    the cover photo the hero shows (wide, with a crop focus)
 *
 * Every variant uploads to the owner's own Storage folder like any other site
 * image; replacing or removing deletes the old file.
 */
export type ImageFieldKind = "profile" | "logo" | "hero";

interface Copy {
  id: string;
  label: string;
  help: string;
  spec: string;
  foot: string;
  note?: string;
  add: string;
  icon: IconName;
}

const COPY: Record<ImageFieldKind, Copy> = {
  profile: {
    id: "profile-photo",
    label: "Your profile photo",
    help: "Optional. Add a professional photo so customers know who they’re dealing with.",
    spec: "Recommended: square portrait, 1000 × 1000 px or larger",
    foot: "PNG or JPG • Clear face, shoulders-up works best • Max 5 MB",
    add: "Add photo",
    icon: "person",
  },
  logo: {
    id: "business-logo",
    label: "Business logo",
    help: "Optional. Shown beside your business name; without one we use your initial.",
    spec: "Recommended: square image, 1000 × 1000 px or larger",
    foot: "PNG or JPG • Square works best • Max 5 MB",
    add: "Upload logo",
    icon: "storefront",
  },
  hero: {
    id: "hero-image",
    label: "Hero / cover photo",
    help: "Make your website instantly feel like your business.",
    spec: "Recommended: 1600 × 900 px (16:9)",
    foot: "JPG or PNG • Landscape works best • Max 5 MB",
    note: "Any shape works — the hero adapts to your photo on phones and desktops. Keep faces and text away from the very edges.",
    add: "Upload cover photo",
    icon: "add_a_photo",
  },
};

const MAX_BYTES = 5 * 1024 * 1024;

const POSITION_LABEL: Record<HeroImagePosition, string> = { center: "Centre", top: "Top", bottom: "Bottom" };

export function ImageUploadField({
  kind,
  uid,
  siteId,
  value,
  onChange,
  onBusy,
  position,
  onPosition,
}: {
  kind: ImageFieldKind;
  uid: string;
  siteId: string;
  value?: SiteImage;
  onChange: (image: SiteImage | undefined) => void;
  /** Lets the parent block "Build" while an upload is in flight. */
  onBusy?: (busy: boolean) => void;
  /** Hero only: which edge to keep when the cover is cropped on small screens. */
  position?: HeroImagePosition;
  onPosition?: (position: HeroImagePosition) => void;
}) {
  const copy = COPY[kind];
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !uid) return;
    if (file.size > MAX_BYTES) {
      setError("That image is over 5 MB. Choose a smaller one.");
      return;
    }
    setError(null);
    setProgress(0);
    onBusy?.(true);
    try {
      const image = await uploadSiteImage(uid, siteId, file, setProgress);
      if (value) void deleteSiteImage(value);
      onChange(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image couldn't be uploaded.");
    } finally {
      setProgress(null);
      onBusy?.(false);
    }
  };

  const remove = () => {
    if (value) void deleteSiteImage(value);
    onChange(undefined);
  };

  const uploading = progress !== null;
  const noun = kind === "hero" ? "cover photo" : kind === "logo" ? "logo" : "profile photo";
  const pick = () => fileInput.current?.click();

  const guidance = (
    <div className="flex flex-col gap-[2px] text-[12px] leading-[1.45] text-muted">
      <span className="font-semibold text-ink/80">{copy.spec}</span>
      <span>{copy.foot}</span>
      {copy.note ? <span>{copy.note}</span> : null}
    </div>
  );

  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" icon={value ? "sync" : copy.icon} iconPosition="left" loading={uploading} onClick={pick}>
        {value ? "Replace" : copy.add}
      </Button>
      {value ? (
        <Button variant="ghost" size="sm" disabled={uploading} onClick={remove}>
          Remove
        </Button>
      ) : null}
    </div>
  );

  const progressBar = uploading ? (
    <span className="absolute inset-x-0 bottom-0 h-1 bg-navy transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
  ) : null;

  return (
    <div className="flex flex-col gap-2" data-image-field={kind}>
      <Label htmlFor={copy.id}>{copy.label}</Label>
      {kind === "hero" ? (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <p className="text-[13px] leading-[1.45] text-muted">{copy.help}</p>
          <button
            id={copy.id}
            type="button"
            aria-label={value ? `Replace ${noun}` : `Upload ${noun}`}
            disabled={uploading}
            onClick={pick}
            className={cn(
              "relative flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-input text-[13px] font-bold disabled:opacity-60",
              value ? "bg-line" : "border-[1.5px] border-dashed border-navy bg-navy-tint text-navy hover:bg-navy-tint/70",
            )}
          >
            {value ? (
              <Image src={value.url} alt="" fill sizes="(max-width: 560px) 100vw, 520px" className={cn("object-cover", position === "top" ? "object-top" : position === "bottom" ? "object-bottom" : "object-center")} unoptimized />
            ) : (
              <>
                <Icon name={copy.icon} size={28} />
                {copy.add}
              </>
            )}
            {progressBar}
          </button>
          {guidance}
          {value && onPosition ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Crop focus">
              <span className="text-[12px] font-semibold text-muted">Keep in view:</span>
              {HERO_IMAGE_POSITIONS.map((option) => {
                const active = (position ?? "center") === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPosition(option)}
                    className={cn(
                      "h-8 rounded-pill border-[1.5px] px-3 text-[12px] font-bold transition-colors",
                      active ? "border-navy bg-navy text-white" : "border-line-input bg-surface text-ink hover:border-navy",
                    )}
                  >
                    {POSITION_LABEL[option]}
                  </button>
                );
              })}
            </div>
          ) : null}
          {buttons}
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-card border border-line bg-surface p-4">
          <button
            id={copy.id}
            type="button"
            aria-label={value ? `Replace ${noun}` : `Add ${noun}`}
            disabled={uploading}
            onClick={pick}
            className={cn(
              "relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden border-[1.5px] border-dashed border-line-input bg-ground text-muted hover:border-navy disabled:opacity-60",
              kind === "profile" ? "rounded-full" : "rounded-[14px]",
            )}
          >
            {value ? (
              <Image src={value.url} alt="" fill sizes="72px" className={kind === "profile" ? "object-cover object-top" : "object-contain p-1"} unoptimized />
            ) : (
              <Icon name={copy.icon} size={30} />
            )}
            {progressBar}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[13px] leading-[1.45] text-muted">{copy.help}</p>
            {guidance}
            {buttons}
          </div>
        </div>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
