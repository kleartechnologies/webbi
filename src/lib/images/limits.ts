/**
 * Upload limits shared by the browser (a friendly early message) and the
 * server (the actual boundary, src/lib/images/storage.ts). Nothing here is
 * secret; changing a value here changes both sides.
 */

/** Largest file Webbi stores. The browser resizes photos first, so real uploads are far smaller. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** The only formats Webbi stores, identified on the server by their bytes, never by a name or header. */
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export const UPLOAD_EXTENSIONS: Record<UploadType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** For <input type="file" accept>. Phones convert HEIC to JPEG when a picker asks for these. */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.join(",");

export const TOO_LARGE_MESSAGE = "That image is over 5 MB. Choose a smaller one.";
export const UNSUPPORTED_MESSAGE = "Please choose a JPG, PNG or WebP photo.";

export function isUploadType(type: string): type is UploadType {
  return (UPLOAD_TYPES as readonly string[]).includes(type);
}
