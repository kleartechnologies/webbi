"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon, Spinner } from "@/components/ui";
import { UPLOAD_ACCEPT } from "@/lib/images/limits";
import { uploadSiteImage } from "@/lib/images/upload";
import type { SiteContent } from "@/lib/site/schema";
import { Badge, SectionHeading } from "./EditorBits";
import { galleryPhotos, setGalleryPhotos, setSitePhotos, sitePhotos } from "./sections";
import type { Update } from "./useDraft";

interface Props {
  site: SiteContent;
  update: Update;
  siteId: string;
}

/** Hero (first) + gallery photos; 24 max like the gallery schema. */
const MAX_PHOTOS = 25;

export function PhotosTab({ site, update, siteId }: Props) {
  // With a dedicated cover photo (Business tab) this tab is the gallery only;
  // older sites without one keep "first photo is the hero".
  const hasCover = Boolean(site.business.heroImage);
  const read = hasCover ? galleryPhotos : sitePhotos;
  const write = hasCover ? setGalleryPhotos : setSitePhotos;
  const photos = read(site);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = Math.max(0, MAX_PHOTOS - photos.length);
    const list = Array.from(files).slice(0, room);
    if (!list.length) return;
    await Promise.all(
      list.map(async (file, index) => {
        const key = `up_${Date.now()}_${index}`;
        setUploading((u) => ({ ...u, [key]: 0 }));
        try {
          const image = await uploadSiteImage(siteId, file, (p) => setUploading((u) => ({ ...u, [key]: p })));
          update((d) => write(d, [...read(d), image]));
        } catch (err) {
          console.error(err);
          setError(err instanceof Error && err.message ? err.message : "One of the photos couldn't be uploaded. Try a smaller image.");
        } finally {
          setUploading((u) => {
            const rest = { ...u };
            delete rest[key];
            return rest;
          });
        }
      }),
    );
  };

  const remove = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    update((d) => write(d, read(d).filter((_, i) => i !== index)));
  };

  const makeHero = (index: number) => {
    update((d) => {
      const list = sitePhotos(d);
      const [photo] = list.splice(index, 1);
      return photo ? setSitePhotos(d, [photo, ...list]) : d;
    });
  };

  return (
    <div className="flex flex-col gap-[10px]">
      <SectionHeading title="Photos" note={hasCover ? "Gallery" : "First photo is your hero"} />
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div key={photo.path ?? photo.url} className="relative aspect-square overflow-hidden rounded-input bg-line">
            <Image src={photo.url} alt={photo.alt ?? ""} fill sizes="(max-width: 560px) 33vw, 180px" className="object-cover" unoptimized />
            {hasCover ? null : index === 0 ? (
              <span className="absolute top-1.5 left-1.5">
                <Badge tone="amber">Hero</Badge>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeHero(index)}
                className="absolute bottom-1.5 left-1.5 rounded-pill bg-ink/75 px-2 py-[3px] text-[11px] font-bold text-white hover:bg-navy"
              >
                Use as hero
              </button>
            )}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => remove(index)}
              className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-white hover:bg-danger"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        {Object.entries(uploading).map(([key, progress]) => (
          <div key={key} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-input bg-line text-navy">
            <Spinner size={22} />
            <span className="absolute bottom-0 left-0 h-1 bg-navy transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-input border-[1.5px] border-dashed border-navy bg-navy-tint text-[12px] font-bold text-navy"
          >
            <Icon name="add_a_photo" size={26} />
            Add
          </button>
        ) : null}
      </div>
      <p className="text-[12px] leading-[1.5] text-muted">
        {hasCover
          ? "Your cover photo is set under Business → Hero / cover photo. These photos form the gallery."
          : photos.length
            ? "Tap “Use as hero” to change the main photo. Webbi crops for each section automatically."
            : "Add a hero photo and a few of your work, space or products. Webbi crops them for you."}
      </p>
      {error ? <p role="alert" className="text-[12px] font-semibold text-danger">{error}</p> : null}
      <input
        ref={fileInput}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
