"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Button, ErrorText, Icon, Label } from "@/components/ui";
import { deleteSiteImage, uploadSiteImage } from "@/lib/images/upload";
import type { SiteImage } from "@/lib/site/schema";

/**
 * Optional profile photo for person-led businesses (sales advisors, agents,
 * tutors...). One round photo, uploaded to the owner's own Storage folder like
 * every other site image; replacing or removing it deletes the old file.
 */
export function ProfilePhotoField({
  uid,
  siteId,
  value,
  onChange,
  onBusy,
}: {
  uid: string;
  siteId: string;
  value?: SiteImage;
  onChange: (image: SiteImage | undefined) => void;
  /** Lets the parent block "Build" while an upload is in flight. */
  onBusy?: (busy: boolean) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !uid) return;
    setError(null);
    setProgress(0);
    onBusy?.(true);
    try {
      const image = await uploadSiteImage(uid, siteId, file, setProgress);
      if (value) void deleteSiteImage(value);
      onChange(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo couldn't be uploaded.");
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
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="profile-photo">Your profile photo</Label>
      <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
        <button
          id="profile-photo"
          type="button"
          aria-label={value ? "Change profile photo" : "Add profile photo"}
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className="relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-full border-[1.5px] border-dashed border-line-input bg-ground text-muted hover:border-navy disabled:opacity-60"
        >
          {value ? (
            <Image src={value.url} alt="" fill sizes="72px" className="object-cover object-top" unoptimized />
          ) : (
            <Icon name="person" size={30} />
          )}
          {uploading ? (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-navy transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          ) : null}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[13px] leading-[1.45] text-muted">
            Optional. Add a professional photo so customers know who they&rsquo;re dealing with.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon="add_a_photo" iconPosition="left" loading={uploading} onClick={() => fileInput.current?.click()}>
              {value ? "Change" : "Add photo"}
            </Button>
            {value ? (
              <Button variant="ghost" size="sm" disabled={uploading} onClick={remove}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
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
