import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getClientStorage } from "@/lib/firebase/client";
import { newId, type SiteImage } from "@/lib/site/schema";
import { optimizeImage } from "./resize";

/** Uploads one optimised photo to users/{uid}/sites/{siteId}/ and returns a Site image. */
export async function uploadSiteImage(
  uid: string,
  siteId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<SiteImage> {
  const optimized = await optimizeImage(file);
  const path = `users/${uid}/sites/${siteId}/${newId("img")}.${optimized.extension}`;
  const storageRef = ref(getClientStorage(), path);
  const task = uploadBytesResumable(storageRef, optimized.blob, {
    contentType: optimized.contentType,
    cacheControl: "public, max-age=31536000, immutable",
  });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
      reject,
      () => resolve(),
    );
  });
  const url = await getDownloadURL(storageRef);
  return { url, path, width: optimized.width, height: optimized.height };
}

export async function deleteSiteImage(image: SiteImage): Promise<void> {
  if (!image.path) return;
  try {
    await deleteObject(ref(getClientStorage(), image.path));
  } catch (error) {
    console.warn("delete image failed", error);
  }
}
